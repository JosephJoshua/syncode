import { zodResolver } from '@hookform/resolvers/zod';
import type { OnMount } from '@monaco-editor/react';
import {
  CONTROL_API,
  type CreateProblemInput,
  type ProblemDetail,
  type ProblemSummary,
  type UpdateProblemInput,
} from '@syncode/contracts';
import { PROBLEM_DIFFICULTIES, SUPPORTED_LANGUAGES } from '@syncode/shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@syncode/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Bold,
  Code2,
  Eye,
  EyeOff,
  FileText,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Pencil,
  Plus,
  Quote,
  RefreshCw,
  ShieldAlert,
  Table2,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, type FieldErrors, useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { AdminTabs } from '@/components/admin/admin-tabs.js';
import { LazyMonacoEditor as Editor } from '@/components/lazy-monaco-editor.js';
import { ProblemMarkdown } from '@/components/problems/problem-markdown.js';
import {
  EDITOR_LOADING,
  EDITOR_OPTIONS_BASE,
  handleEditorWillMount,
} from '@/components/room-workspace-utils.js';
import { api, readApiError } from '@/lib/api-client.js';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/_app/admin/problems')({
  component: AdminProblemEditorPage,
});

const difficulties = PROBLEM_DIFFICULTIES;

const optionalLimitSchema = (max: number, message: string) =>
  z.string().refine((value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return true;
    }
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= max;
  }, message);

const adminProblemFormSchema = z.object({
  title: z.string().trim().min(1, 'problemEditor.validation.title'),
  difficulty: z.enum(PROBLEM_DIFFICULTIES),
  company: z.string(),
  description: z.string().trim().min(1, 'problemEditor.validation.description'),
  constraints: z.string(),
  examplesText: z
    .string()
    .refine((value) => parseExamples(value).ok, 'problemEditor.validation.examples'),
  starterCodeText: z
    .string()
    .refine((value) => parseStarterCode(value).ok, 'problemEditor.validation.starterCode'),
  timeLimit: optionalLimitSchema(60_000, 'problemEditor.validation.timeLimit'),
  memoryLimit: optionalLimitSchema(4096, 'problemEditor.validation.memoryLimit'),
  isPublished: z.boolean(),
  testCases: z
    .array(
      z.object({
        input: z.string().trim().min(1, 'problemEditor.validation.testCases'),
        expectedOutput: z.string().trim().min(1, 'problemEditor.validation.testCases'),
        description: z.string(),
        isHidden: z.boolean(),
        timeoutMs: optionalLimitSchema(60_000, 'problemEditor.validation.testCaseLimits'),
        memoryMb: optionalLimitSchema(4096, 'problemEditor.validation.testCaseLimits'),
      }),
    )
    .min(1, 'problemEditor.validation.testCases'),
});

type AdminProblemFormValues = z.infer<typeof adminProblemFormSchema>;

function AdminProblemEditorPage() {
  const { t, i18n } = useTranslation('admin');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProblemSummary | null>(null);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    watch,
  } = useForm<AdminProblemFormValues>({
    resolver: zodResolver(adminProblemFormSchema),
    defaultValues: createDefaultFormValues(),
  });
  const { append, fields, remove } = useFieldArray({ control, name: 'testCases' });
  const watchedValues = watch();

  const problemsQuery = useQuery({
    queryKey: ['admin', 'problems', 'list'],
    enabled: user?.role === 'admin',
    queryFn: () =>
      api(CONTROL_API.PROBLEMS.LIST, {
        searchParams: { limit: 50, sortBy: 'createdAt', sortOrder: 'desc', includeDrafts: true },
      }),
  });

  const problemDetailQuery = useQuery({
    queryKey: ['admin', 'problems', 'detail', selectedProblemId],
    enabled: user?.role === 'admin' && selectedProblemId !== null,
    queryFn: () => api(CONTROL_API.PROBLEMS.GET_BY_ID, { params: { id: selectedProblemId ?? '' } }),
  });

  const createProblemMutation = useMutation({
    mutationFn: (input: CreateProblemInput) => api(CONTROL_API.PROBLEMS.CREATE, { body: input }),
    onSuccess: async (problem) => {
      toast.success(t('problemEditor.toast.saved'));
      closeProblemEditor();
      await invalidateProblemQueries(queryClient);
      navigate({ to: '/problems/$problemId', params: { problemId: problem.id } }).catch(
        () => undefined,
      );
    },
    onError: async (error) => {
      const apiError = await readApiError(error);
      toast.error(apiError?.message ?? t('problemEditor.toast.saveFailed'));
    },
  });

  const updateProblemMutation = useMutation({
    mutationFn: async ({
      problemId,
      input,
      isPublished,
    }: {
      problemId: string;
      input: UpdateProblemInput;
      isPublished: boolean;
    }) => {
      const updated = await api(CONTROL_API.PROBLEMS.UPDATE, {
        params: { id: problemId },
        body: input,
      });
      if (updated.isPublished !== isPublished) {
        return api(CONTROL_API.PROBLEMS.PUBLISH_STATUS, {
          params: { id: problemId },
          body: { isPublished },
        });
      }
      return updated;
    },
    onSuccess: async (problem) => {
      toast.success(t('problemEditor.toast.saved'));
      reset(problemDetailToFormValues(problem));
      closeProblemEditor();
      await invalidateProblemQueries(queryClient);
    },
    onError: async (error) => {
      const apiError = await readApiError(error);
      toast.error(apiError?.message ?? t('problemEditor.toast.saveFailed'));
    },
  });

  const publishStatusMutation = useMutation({
    mutationFn: ({ problemId, isPublished }: { problemId: string; isPublished: boolean }) =>
      api(CONTROL_API.PROBLEMS.PUBLISH_STATUS, {
        params: { id: problemId },
        body: { isPublished },
      }),
    onSuccess: async () => {
      toast.success(t('problemEditor.toast.statusSaved'));
      await invalidateProblemQueries(queryClient);
    },
    onError: async (error) => {
      const apiError = await readApiError(error);
      toast.error(apiError?.message ?? t('problemEditor.toast.saveFailed'));
    },
  });

  const deleteProblemMutation = useMutation({
    mutationFn: (problemId: string) =>
      api(CONTROL_API.PROBLEMS.DELETE, { params: { id: problemId } }),
    onSuccess: async () => {
      toast.success(t('problemEditor.toast.deleted'));
      setDeleteTarget(null);
      if (selectedProblemId === deleteTarget?.id) {
        setSelectedProblemId(null);
        reset(createDefaultFormValues());
      }
      await invalidateProblemQueries(queryClient);
    },
    onError: async (error) => {
      const apiError = await readApiError(error);
      toast.error(apiError?.message ?? t('problemEditor.toast.deleteFailed'));
    },
  });

  useEffect(() => {
    if (problemDetailQuery.data && problemDetailQuery.data.id === selectedProblemId) {
      reset(problemDetailToFormValues(problemDetailQuery.data));
    }
  }, [problemDetailQuery.data, reset, selectedProblemId]);

  const completedCaseCount = useMemo(
    () =>
      watchedValues.testCases.filter((item) => item.input.trim() && item.expectedOutput.trim())
        .length,
    [watchedValues.testCases],
  );
  const formErrors = useMemo(() => collectErrorMessages(errors), [errors]);
  const problems = problemsQuery.data?.data ?? [];
  const selectedProblem = problems.find((problem) => problem.id === selectedProblemId) ?? null;
  const isSaving = createProblemMutation.isPending || updateProblemMutation.isPending;
  const isProblemDetailError = selectedProblemId !== null && problemDetailQuery.isError;
  const isProblemDetailLoading =
    selectedProblemId !== null &&
    !isProblemDetailError &&
    (problemDetailQuery.isLoading || problemDetailQuery.data?.id !== selectedProblemId);
  const isFormDisabled = isSaving || isProblemDetailLoading || isProblemDetailError;
  const isMutating = isSaving || publishStatusMutation.isPending || deleteProblemMutation.isPending;
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [i18n.language, i18n.resolvedLanguage],
  );

  if (user?.role !== 'admin') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
        <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
          <CardContent className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 inline-flex size-12 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10 text-destructive">
              <ShieldAlert className="size-5" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {t('problemEditor.forbidden.title')}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              {t('problemEditor.forbidden.description')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const submitForm = (values: AdminProblemFormValues) => {
    if (selectedProblemId) {
      updateProblemMutation.mutate({
        problemId: selectedProblemId,
        input: buildUpdateProblemInput(values),
        isPublished: values.isPublished,
      });
      return;
    }

    createProblemMutation.mutate(buildCreateProblemInput(values));
  };

  const startNewProblem = () => {
    setSelectedProblemId(null);
    reset(createDefaultFormValues());
    setIsEditorOpen(true);
  };

  const selectProblemForEdit = (problemId: string) => {
    setSelectedProblemId(problemId);
    reset(createDefaultFormValues());
    setIsEditorOpen(true);
  };

  function closeProblemEditor() {
    if (isMutating) {
      return;
    }
    setIsEditorOpen(false);
    setSelectedProblemId(null);
    reset(createDefaultFormValues());
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('problemEditor.management.heading')}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            {t('problemEditor.management.sub')}
          </p>
        </div>
        <div className="flex flex-nowrap items-center gap-3 self-start lg:self-auto">
          <AdminTabs
            active="problems"
            labels={{
              users: t('navLinks.users'),
              problems: t('navLinks.problems'),
              auditLogs: t('navLinks.auditLogs'),
            }}
          />
          <Button type="button" className="h-11 shrink-0" onClick={startNewProblem}>
            <Plus className="size-4" />
            {t('problemEditor.management.newProblem')}
          </Button>
        </div>
      </section>

      <Card className="mt-8 gap-0 overflow-hidden border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
        <CardHeader className="flex-row items-center justify-between px-5 py-4 sm:px-6">
          <CardTitle>{t('problemEditor.management.tableTitle')}</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={problemsQuery.isFetching}
            onClick={() => problemsQuery.refetch()}
          >
            <RefreshCw className={problemsQuery.isFetching ? 'size-4 animate-spin' : 'size-4'} />
            {t('problemEditor.management.refresh')}
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {problemsQuery.isError ? (
            <div role="alert" className="px-6 py-10 text-sm text-destructive">
              {t('problemEditor.management.loadFailed')}
            </div>
          ) : problemsQuery.isLoading ? (
            <div className="flex min-h-60 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('problemEditor.management.loading')}
            </div>
          ) : problems.length === 0 ? (
            <div className="px-6 py-10 text-sm text-muted-foreground">
              {t('problemEditor.management.empty')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('problemEditor.management.columns.problem')}</TableHead>
                  <TableHead className="w-28">
                    {t('problemEditor.management.columns.status')}
                  </TableHead>
                  <TableHead className="w-28">
                    {t('problemEditor.management.columns.tests')}
                  </TableHead>
                  <TableHead className="w-36">
                    {t('problemEditor.management.columns.updated')}
                  </TableHead>
                  <TableHead className="w-56 text-right">
                    {t('problemEditor.management.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {problems.map((problem) => (
                  <TableRow key={problem.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{problem.title}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant="outline">
                            {t(`problemEditor.difficulty.${problem.difficulty}`)}
                          </Badge>
                          {problem.company ? (
                            <Badge variant="neutral">{problem.company}</Badge>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={problem.isPublished ? 'success' : 'secondary'}>
                        {problem.isPublished
                          ? t('problemEditor.preview.statusPublished')
                          : t('problemEditor.preview.statusDraft')}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {problem.testCaseCount ?? 0}
                      {problem.hiddenTestCaseCount
                        ? ` (${t('problemEditor.management.hiddenCount', {
                            count: problem.hiddenTestCaseCount,
                          })})`
                        : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {problem.updatedAt ? dateFormatter.format(new Date(problem.updatedAt)) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isMutating}
                          onClick={() => selectProblemForEdit(problem.id)}
                        >
                          <Pencil className="size-4" />
                          {t('problemEditor.management.edit')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={publishStatusMutation.isPending}
                          onClick={() =>
                            publishStatusMutation.mutate({
                              problemId: problem.id,
                              isPublished: !problem.isPublished,
                            })
                          }
                        >
                          {problem.isPublished ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                          {problem.isPublished
                            ? t('problemEditor.management.unpublish')
                            : t('problemEditor.management.publish')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={deleteProblemMutation.isPending}
                          onClick={() => setDeleteTarget(problem)}
                        >
                          <Trash2 className="size-4" />
                          {t('problemEditor.management.delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isEditorOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsEditorOpen(true);
            return;
          }
          closeProblemEditor();
        }}
      >
        <DialogContent className="w-[min(calc(100vw-2rem),96rem)] max-w-[min(calc(100vw-2rem),96rem)] gap-0 p-0 sm:max-w-[min(calc(100vw-2rem),96rem)]">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle>
              {selectedProblem
                ? t('problemEditor.editorDialog.editTitle', { title: selectedProblem.title })
                : t('problemEditor.editorDialog.createTitle')}
            </DialogTitle>
            <DialogDescription>{t('problemEditor.editorDialog.description')}</DialogDescription>
          </DialogHeader>
          <form
            className="grid max-h-[calc(100vh-7rem)] gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_380px]"
            onSubmit={handleSubmit(submitForm)}
          >
            <fieldset className="space-y-6 disabled:opacity-70" disabled={isFormDisabled}>
              {isProblemDetailError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {t('problemEditor.editorDialog.loadFailed')}
                </div>
              ) : null}
              {isProblemDetailLoading ? (
                <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t('problemEditor.editorDialog.loading')}
                </div>
              ) : (
                <>
                  <section className="grid gap-5 rounded-lg border border-border/50 p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label={t('problemEditor.fields.title')} htmlFor="problem-title">
                        <Input
                          id="problem-title"
                          placeholder={t('problemEditor.fields.titlePlaceholder')}
                          {...register('title')}
                        />
                      </Field>
                      <Field
                        label={t('problemEditor.fields.difficulty')}
                        htmlFor="problem-difficulty"
                      >
                        <select
                          id="problem-difficulty"
                          className="h-11 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium outline-none transition-[border-color,box-shadow] focus-visible:border-ring/60 focus-visible:ring-3 focus-visible:ring-ring/40"
                          {...register('difficulty')}
                        >
                          {difficulties.map((item) => (
                            <option key={item} value={item}>
                              {t(`problemEditor.difficulty.${item}`)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <Field label={t('problemEditor.fields.company')} htmlFor="problem-company">
                      <Input
                        id="problem-company"
                        placeholder={t('problemEditor.fields.companyPlaceholder')}
                        {...register('company')}
                      />
                    </Field>

                    <Controller
                      control={control}
                      name="description"
                      render={({ field }) => (
                        <MarkdownEditor
                          label={t('problemEditor.fields.description')}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={t('problemEditor.fields.descriptionPlaceholder')}
                        />
                      )}
                    />

                    <Field
                      label={t('problemEditor.fields.constraints')}
                      htmlFor="problem-constraints"
                    >
                      <textarea
                        id="problem-constraints"
                        placeholder={t('problemEditor.fields.constraintsPlaceholder')}
                        className="min-h-28 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring/60 focus-visible:ring-3 focus-visible:ring-ring/40"
                        {...register('constraints')}
                      />
                    </Field>
                  </section>

                  <section className="grid gap-5 rounded-lg border border-border/50 p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field
                        label={t('problemEditor.fields.timeLimit')}
                        htmlFor="problem-time-limit"
                      >
                        <Input
                          id="problem-time-limit"
                          type="number"
                          min={1}
                          max={60000}
                          placeholder={t('problemEditor.fields.timeLimitPlaceholder')}
                          {...register('timeLimit')}
                        />
                      </Field>
                      <Field
                        label={t('problemEditor.fields.memoryLimit')}
                        htmlFor="problem-memory-limit"
                      >
                        <Input
                          id="problem-memory-limit"
                          type="number"
                          min={1}
                          max={4096}
                          placeholder={t('problemEditor.fields.memoryLimitPlaceholder')}
                          {...register('memoryLimit')}
                        />
                      </Field>
                    </div>

                    <Field label={t('problemEditor.fields.examples')} htmlFor="problem-examples">
                      <textarea
                        id="problem-examples"
                        placeholder={t('problemEditor.fields.examplesPlaceholder')}
                        className="min-h-28 w-full rounded-lg border border-input bg-background px-4 py-3 font-mono text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring/60 focus-visible:ring-3 focus-visible:ring-ring/40"
                        {...register('examplesText')}
                      />
                    </Field>

                    <Field
                      label={t('problemEditor.fields.starterCode')}
                      htmlFor="problem-starter-code"
                    >
                      <textarea
                        id="problem-starter-code"
                        placeholder={t('problemEditor.fields.starterCodePlaceholder')}
                        className="min-h-28 w-full rounded-lg border border-input bg-background px-4 py-3 font-mono text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring/60 focus-visible:ring-3 focus-visible:ring-ring/40"
                        {...register('starterCodeText')}
                      />
                    </Field>
                  </section>

                  <section className="grid gap-4 rounded-lg border border-border/50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-semibold text-foreground">
                        {t('problemEditor.testCases.title')}
                      </h2>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => append(createTestCase())}
                      >
                        <Plus className="size-4" />
                        {t('problemEditor.testCases.add')}
                      </Button>
                    </div>
                    {fields.map((item, index) => (
                      <div
                        key={item.id}
                        className="grid gap-3 rounded-lg border border-border/50 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{index + 1}</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            disabled={fields.length === 1}
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="size-4" />
                            {t('problemEditor.testCases.remove')}
                          </Button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <Field
                            label={t('problemEditor.testCases.input')}
                            htmlFor={`${item.id}-in`}
                          >
                            <Input
                              id={`${item.id}-in`}
                              placeholder={t('problemEditor.testCases.inputPlaceholder')}
                              {...register(`testCases.${index}.input`)}
                            />
                          </Field>
                          <Field
                            label={t('problemEditor.testCases.output')}
                            htmlFor={`${item.id}-out`}
                          >
                            <Input
                              id={`${item.id}-out`}
                              placeholder={t('problemEditor.testCases.outputPlaceholder')}
                              {...register(`testCases.${index}.expectedOutput`)}
                            />
                          </Field>
                        </div>
                        <Field
                          label={t('problemEditor.testCases.description')}
                          htmlFor={`${item.id}-description`}
                        >
                          <Input
                            id={`${item.id}-description`}
                            placeholder={t('problemEditor.testCases.descriptionPlaceholder')}
                            {...register(`testCases.${index}.description`)}
                          />
                        </Field>
                        <div className="grid gap-3 md:grid-cols-3">
                          <Field
                            label={t('problemEditor.testCases.timeoutMs')}
                            htmlFor={`${item.id}-timeout`}
                          >
                            <Input
                              id={`${item.id}-timeout`}
                              type="number"
                              min={1}
                              max={60000}
                              placeholder={t('problemEditor.testCases.timeoutPlaceholder')}
                              {...register(`testCases.${index}.timeoutMs`)}
                            />
                          </Field>
                          <Field
                            label={t('problemEditor.testCases.memoryMb')}
                            htmlFor={`${item.id}-memory`}
                          >
                            <Input
                              id={`${item.id}-memory`}
                              type="number"
                              min={1}
                              max={4096}
                              placeholder={t('problemEditor.testCases.memoryPlaceholder')}
                              {...register(`testCases.${index}.memoryMb`)}
                            />
                          </Field>
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
                            <Label htmlFor={`${item.id}-hidden`}>
                              {t('problemEditor.testCases.hidden')}
                            </Label>
                            <Controller
                              control={control}
                              name={`testCases.${index}.isHidden`}
                              render={({ field }) => (
                                <Switch
                                  id={`${item.id}-hidden`}
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </section>
                </>
              )}
            </fieldset>

            <aside className="space-y-5">
              <div className="rounded-lg border border-border/50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="published-toggle">{t('problemEditor.fields.published')}</Label>
                  <Controller
                    control={control}
                    name="isPublished"
                    render={({ field }) => (
                      <Switch
                        id="published-toggle"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isFormDisabled}
                      />
                    )}
                  />
                </div>
                <div className="mt-4 space-y-3 rounded-lg border border-border/50 bg-card/40 p-4">
                  <div>
                    <p className="font-medium text-foreground">
                      {watchedValues.title || t('problemEditor.fields.titlePlaceholder')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {watchedValues.company || t('problemEditor.fields.companyPlaceholder')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {t(`problemEditor.difficulty.${watchedValues.difficulty}`)}
                    </Badge>
                    <Badge variant={watchedValues.isPublished ? 'success' : 'secondary'}>
                      {watchedValues.isPublished
                        ? t('problemEditor.preview.statusPublished')
                        : t('problemEditor.preview.statusDraft')}
                    </Badge>
                    <Badge variant="outline">
                      {t('problemEditor.preview.caseCount', { count: completedCaseCount })}
                    </Badge>
                  </div>
                </div>
                {formErrors.length > 0 ? (
                  <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {formErrors.map((error) => (
                      <p key={error}>{t(error)}</p>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isMutating}
                  onClick={closeProblemEditor}
                >
                  {t('problemEditor.actions.cancel')}
                </Button>
                <Button type="submit" disabled={isFormDisabled}>
                  {isSaving ? t('problemEditor.actions.saving') : t('problemEditor.actions.save')}
                </Button>
              </div>
            </aside>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('problemEditor.deleteDialog.title', { title: deleteTarget?.title ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('problemEditor.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProblemMutation.isPending}>
              {t('problemEditor.actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteProblemMutation.isPending || !deleteTarget}
              onClick={() => deleteTarget && deleteProblemMutation.mutate(deleteTarget.id)}
            >
              {t('problemEditor.management.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { AdminProblemEditorPage };

function Field({
  label,
  htmlFor,
  children,
}: {
  readonly label: string;
  readonly htmlFor: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function createTestCase(): AdminProblemFormValues['testCases'][number] {
  return {
    input: '',
    expectedOutput: '',
    description: '',
    isHidden: false,
    timeoutMs: '',
    memoryMb: '',
  };
}

function buildCreateProblemInput(values: AdminProblemFormValues): CreateProblemInput {
  const examples = parseExamples(values.examplesText);
  const starterCode = parseStarterCode(values.starterCodeText);

  if (!examples.ok || !starterCode.ok) {
    throw new Error('Invalid problem form data');
  }

  return {
    title: values.title.trim(),
    description: values.description.trim(),
    difficulty: values.difficulty,
    isPublished: values.isPublished,
    company: values.company.trim() || null,
    constraints: values.constraints.trim() || null,
    examples: examples.value,
    starterCode: starterCode.value,
    timeLimit: parseOptionalPositiveInteger(values.timeLimit, 60_000) ?? null,
    memoryLimit: parseOptionalPositiveInteger(values.memoryLimit, 4096) ?? null,
    testCases: values.testCases.map((item) => ({
      input: item.input.trim(),
      expectedOutput: item.expectedOutput.trim(),
      description: item.description.trim() || undefined,
      isHidden: item.isHidden,
      timeoutMs: parseOptionalPositiveInteger(item.timeoutMs, 60_000) ?? undefined,
      memoryMb: parseOptionalPositiveInteger(item.memoryMb, 4096) ?? undefined,
    })),
  };
}

function collectErrorMessages(errors: FieldErrors<AdminProblemFormValues>): string[] {
  const testCaseErrors = Array.isArray(errors.testCases) ? errors.testCases : [];
  const messages = [
    errors.title?.message,
    errors.description?.message,
    errors.examplesText?.message,
    errors.starterCodeText?.message,
    errors.timeLimit?.message,
    errors.memoryLimit?.message,
    errors.testCases?.message,
    ...testCaseErrors.flatMap((error) => [
      error?.input?.message,
      error?.expectedOutput?.message,
      error?.timeoutMs?.message,
      error?.memoryMb?.message,
    ]),
  ].filter((message): message is string => typeof message === 'string');

  return [...new Set(messages)];
}

function parseExamples(
  value: string,
): { ok: true; value: CreateProblemInput['examples'] } | { ok: false } {
  try {
    const parsed = JSON.parse(value || '[]');
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (item) =>
          item !== null &&
          typeof item === 'object' &&
          typeof (item as { input?: unknown }).input === 'string' &&
          typeof (item as { output?: unknown }).output === 'string' &&
          (!('explanation' in item) ||
            typeof (item as { explanation?: unknown }).explanation === 'string'),
      )
    ) {
      return { ok: false };
    }
    return { ok: true, value: parsed as CreateProblemInput['examples'] };
  } catch {
    return { ok: false };
  }
}

function parseStarterCode(
  value: string,
): { ok: true; value: CreateProblemInput['starterCode'] } | { ok: false } {
  try {
    const parsed = JSON.parse(value || '{}');
    if (
      parsed === null ||
      Array.isArray(parsed) ||
      typeof parsed !== 'object' ||
      !Object.keys(parsed).every((key) =>
        (SUPPORTED_LANGUAGES as readonly string[]).includes(key),
      ) ||
      !Object.values(parsed).every((entry) => typeof entry === 'string')
    ) {
      return { ok: false };
    }
    return {
      ok: true,
      value: Object.keys(parsed).length ? (parsed as Record<string, string>) : null,
    };
  } catch {
    return { ok: false };
  }
}

function parseOptionalPositiveInteger(value: string, max: number): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    return null;
  }
  return parsed;
}

import { zodResolver } from '@hookform/resolvers/zod';
import { CONTROL_API, type CreateProblemInput } from '@syncode/contracts';
import { PROBLEM_DIFFICULTIES, type ProblemDifficulty, SUPPORTED_LANGUAGES } from '@syncode/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@syncode/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { FileText, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Controller, type FieldErrors, useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { ProblemMarkdown } from '@/components/problems/problem-markdown.js';
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

const defaultFormValues: AdminProblemFormValues = {
  title: '',
  difficulty: 'medium',
  company: '',
  description: '',
  constraints: '',
  examplesText: '[]',
  starterCodeText: '{}',
  timeLimit: '',
  memoryLimit: '',
  isPublished: false,
  testCases: [createTestCase()],
};

function AdminProblemEditorPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [descriptionMode, setDescriptionMode] = useState<'edit' | 'preview'>('edit');
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = useForm<AdminProblemFormValues>({
    resolver: zodResolver(adminProblemFormSchema),
    defaultValues: defaultFormValues,
  });
  const { append, fields, remove } = useFieldArray({ control, name: 'testCases' });
  const watchedValues = watch();

  const createProblemMutation = useMutation({
    mutationFn: (input: CreateProblemInput) => api(CONTROL_API.PROBLEMS.CREATE, { body: input }),
    onSuccess: (problem) => {
      toast.success(t('problemEditor.toast.saved'));
      queryClient.invalidateQueries({ queryKey: ['problems'] }).catch(() => undefined);
      navigate({ to: '/problems/$problemId', params: { problemId: problem.id } }).catch(
        () => undefined,
      );
    },
    onError: async (error) => {
      const apiError = await readApiError(error);
      toast.error(apiError?.message ?? t('problemEditor.toast.saveFailed'));
    },
  });

  const completedCaseCount = useMemo(
    () =>
      watchedValues.testCases.filter((item) => item.input.trim() && item.expectedOutput.trim())
        .length,
    [watchedValues.testCases],
  );
  const formErrors = useMemo(() => collectErrorMessages(errors), [errors]);

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
    createProblemMutation.mutate(buildCreateProblemInput(values));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('problemEditor.heading')}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t('problemEditor.sub')}</p>
      </section>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link to="/admin/users">{t('navLinks.users')}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/admin/audit-logs">{t('navLinks.auditLogs')}</Link>
        </Button>
      </div>

      <form
        className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
        onSubmit={handleSubmit(submitForm)}
      >
        <div className="space-y-6">
          <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
            <CardHeader className="px-5 pt-6 pb-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                {t('problemEditor.heading')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 px-5 pb-6 sm:px-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t('problemEditor.fields.title')} htmlFor="problem-title">
                  <Input
                    id="problem-title"
                    placeholder={t('problemEditor.fields.titlePlaceholder')}
                    {...register('title')}
                  />
                </Field>
                <Field label={t('problemEditor.fields.difficulty')} htmlFor="problem-difficulty">
                  <Controller
                    control={control}
                    name="difficulty"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => field.onChange(value as ProblemDifficulty)}
                      >
                        <SelectTrigger id="problem-difficulty">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {difficulties.map((item) => (
                            <SelectItem key={item} value={item}>
                              {t(`problemEditor.difficulty.${item}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>

              <Field label={t('problemEditor.fields.company')} htmlFor="problem-company">
                <Input
                  id="problem-company"
                  placeholder={t('problemEditor.fields.companyPlaceholder')}
                  {...register('company')}
                />
              </Field>

              <Field label={t('problemEditor.fields.description')} htmlFor="problem-description">
                <div className="overflow-hidden rounded-lg border border-input bg-background">
                  <div className="flex items-center border-b border-border/60 bg-muted/30 p-1">
                    {(['edit', 'preview'] as const).map((mode) => (
                      <Button
                        key={mode}
                        type="button"
                        size="xs"
                        variant={descriptionMode === mode ? 'secondary' : 'ghost'}
                        onClick={() => setDescriptionMode(mode)}
                      >
                        {t(`problemEditor.editor.${mode}`)}
                      </Button>
                    ))}
                  </div>
                  {descriptionMode === 'edit' ? (
                    <textarea
                      id="problem-description"
                      placeholder={t('problemEditor.fields.descriptionPlaceholder')}
                      className="min-h-48 w-full resize-y bg-transparent px-4 py-3 text-sm outline-none"
                      {...register('description')}
                    />
                  ) : (
                    <div className="min-h-48 px-4 py-3">
                      {watchedValues.description.trim() ? (
                        <ProblemMarkdown content={watchedValues.description} />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t('problemEditor.editor.emptyPreview')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Field>

              <Field label={t('problemEditor.fields.constraints')} htmlFor="problem-constraints">
                <textarea
                  id="problem-constraints"
                  placeholder={t('problemEditor.fields.constraintsPlaceholder')}
                  className="min-h-28 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring/60 focus-visible:ring-3 focus-visible:ring-ring/40"
                  {...register('constraints')}
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t('problemEditor.fields.timeLimit')} htmlFor="problem-time-limit">
                  <Input
                    id="problem-time-limit"
                    type="number"
                    min={1}
                    max={60000}
                    placeholder={t('problemEditor.fields.timeLimitPlaceholder')}
                    {...register('timeLimit')}
                  />
                </Field>
                <Field label={t('problemEditor.fields.memoryLimit')} htmlFor="problem-memory-limit">
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

              <Field label={t('problemEditor.fields.starterCode')} htmlFor="problem-starter-code">
                <textarea
                  id="problem-starter-code"
                  placeholder={t('problemEditor.fields.starterCodePlaceholder')}
                  className="min-h-28 w-full rounded-lg border border-input bg-background px-4 py-3 font-mono text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring/60 focus-visible:ring-3 focus-visible:ring-ring/40"
                  {...register('starterCodeText')}
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
            <CardHeader className="flex-row items-center justify-between px-5 pt-6 pb-4 sm:px-6">
              <CardTitle>{t('problemEditor.testCases.title')}</CardTitle>
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={createProblemMutation.isPending}
                onClick={() => append(createTestCase())}
              >
                <Plus className="size-4" />
                {t('problemEditor.testCases.add')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-6 sm:px-6">
              {fields.map((item, index) => (
                <div key={item.id} className="grid gap-3 rounded-lg border border-border/50 p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{index + 1}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      disabled={fields.length === 1 || createProblemMutation.isPending}
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-4" />
                      {t('problemEditor.testCases.remove')}
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label={t('problemEditor.testCases.input')} htmlFor={`${item.id}-in`}>
                      <Input
                        id={`${item.id}-in`}
                        placeholder={t('problemEditor.testCases.inputPlaceholder')}
                        {...register(`testCases.${index}.input`)}
                      />
                    </Field>
                    <Field label={t('problemEditor.testCases.output')} htmlFor={`${item.id}-out`}>
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
                            disabled={createProblemMutation.isPending}
                          />
                        )}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
            <CardHeader className="px-5 pt-6 pb-4">
              <CardTitle>{t('problemEditor.preview.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-6">
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
                      disabled={createProblemMutation.isPending}
                    />
                  )}
                />
              </div>
              <div className="space-y-3 rounded-lg border border-border/50 bg-background/50 p-4">
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
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {formErrors.map((error) => (
                    <p key={error}>{t(error)}</p>
                  ))}
                </div>
              ) : null}
              <Button type="submit" className="w-full" disabled={createProblemMutation.isPending}>
                {createProblemMutation.isPending
                  ? t('problemEditor.actions.saving')
                  : t('problemEditor.actions.save')}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </form>
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

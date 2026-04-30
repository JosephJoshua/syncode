import type { ProblemDifficulty } from '@syncode/shared';
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
import { createFileRoute } from '@tanstack/react-router';
import { FileText, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/_app/admin/problems')({
  component: AdminProblemEditorPage,
});

type TestCaseDraft = {
  id: string;
  input: string;
  expectedOutput: string;
};

const difficulties: ProblemDifficulty[] = ['easy', 'medium', 'hard'];

function AdminProblemEditorPage() {
  const { t } = useTranslation('admin');
  const user = useAuthStore((state) => state.user);
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>('medium');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [constraints, setConstraints] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [testCases, setTestCases] = useState<TestCaseDraft[]>([createTestCase()]);
  const [errors, setErrors] = useState<string[]>([]);

  const completedCaseCount = useMemo(
    () => testCases.filter((item) => item.input.trim() && item.expectedOutput.trim()).length,
    [testCases],
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

  const validate = () => {
    const nextErrors = [
      title.trim() ? null : t('problemEditor.validation.title'),
      description.trim() ? null : t('problemEditor.validation.description'),
      testCases.every((item) => item.input.trim() && item.expectedOutput.trim())
        ? null
        : t('problemEditor.validation.testCases'),
    ].filter((item): item is string => Boolean(item));

    setErrors(nextErrors);
    if (nextErrors.length === 0) {
      toast.success(t('problemEditor.toast.saved'));
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('problemEditor.heading')}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t('problemEditor.sub')}</p>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
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
                    value={title}
                    placeholder={t('problemEditor.fields.titlePlaceholder')}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </Field>
                <Field label={t('problemEditor.fields.difficulty')} htmlFor="problem-difficulty">
                  <Select
                    value={difficulty}
                    onValueChange={(value) => setDifficulty(value as ProblemDifficulty)}
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
                </Field>
              </div>

              <Field label={t('problemEditor.fields.company')} htmlFor="problem-company">
                <Input
                  id="problem-company"
                  value={company}
                  placeholder={t('problemEditor.fields.companyPlaceholder')}
                  onChange={(event) => setCompany(event.target.value)}
                />
              </Field>

              <Field label={t('problemEditor.fields.description')} htmlFor="problem-description">
                <textarea
                  id="problem-description"
                  value={description}
                  placeholder={t('problemEditor.fields.descriptionPlaceholder')}
                  className="min-h-48 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring/60 focus-visible:ring-3 focus-visible:ring-ring/40"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>

              <Field label={t('problemEditor.fields.constraints')} htmlFor="problem-constraints">
                <textarea
                  id="problem-constraints"
                  value={constraints}
                  placeholder={t('problemEditor.fields.constraintsPlaceholder')}
                  className="min-h-28 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring/60 focus-visible:ring-3 focus-visible:ring-ring/40"
                  onChange={(event) => setConstraints(event.target.value)}
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
                onClick={() => setTestCases((current) => [...current, createTestCase()])}
              >
                <Plus className="size-4" />
                {t('problemEditor.testCases.add')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-6 sm:px-6">
              {testCases.map((item, index) => (
                <div key={item.id} className="grid gap-3 rounded-lg border border-border/50 p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{index + 1}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={testCases.length === 1}
                      onClick={() =>
                        setTestCases((current) => current.filter((entry) => entry.id !== item.id))
                      }
                    >
                      <Trash2 className="size-4" />
                      {t('problemEditor.testCases.remove')}
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label={t('problemEditor.testCases.input')} htmlFor={`${item.id}-in`}>
                      <Input
                        id={`${item.id}-in`}
                        value={item.input}
                        placeholder={t('problemEditor.testCases.inputPlaceholder')}
                        onChange={(event) =>
                          updateTestCase(setTestCases, item.id, { input: event.target.value })
                        }
                      />
                    </Field>
                    <Field label={t('problemEditor.testCases.output')} htmlFor={`${item.id}-out`}>
                      <Input
                        id={`${item.id}-out`}
                        value={item.expectedOutput}
                        placeholder={t('problemEditor.testCases.outputPlaceholder')}
                        onChange={(event) =>
                          updateTestCase(setTestCases, item.id, {
                            expectedOutput: event.target.value,
                          })
                        }
                      />
                    </Field>
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
                <Switch
                  id="published-toggle"
                  checked={isPublished}
                  onCheckedChange={setIsPublished}
                />
              </div>
              <div className="space-y-3 rounded-lg border border-border/50 bg-background/50 p-4">
                <div>
                  <p className="font-medium text-foreground">
                    {title || t('problemEditor.fields.titlePlaceholder')}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {company || t('problemEditor.fields.companyPlaceholder')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{t(`problemEditor.difficulty.${difficulty}`)}</Badge>
                  <Badge variant={isPublished ? 'success' : 'secondary'}>
                    {isPublished
                      ? t('problemEditor.preview.statusPublished')
                      : t('problemEditor.preview.statusDraft')}
                  </Badge>
                  <Badge variant="outline">
                    {t('problemEditor.preview.caseCount', { count: completedCaseCount })}
                  </Badge>
                </div>
              </div>
              {errors.length > 0 ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}
              <Button className="w-full" onClick={validate}>
                {t('problemEditor.actions.save')}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

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

function createTestCase(): TestCaseDraft {
  return {
    id: crypto.randomUUID(),
    input: '',
    expectedOutput: '',
  };
}

function updateTestCase(
  setTestCases: React.Dispatch<React.SetStateAction<TestCaseDraft[]>>,
  id: string,
  patch: Partial<TestCaseDraft>,
) {
  setTestCases((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
}

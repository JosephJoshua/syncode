import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@syncode/ui';
import { Check, LoaderCircle } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { type Control, Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  type SessionFeedbackCandidate,
  type SessionFeedbackFormValues,
  sessionFeedbackFormSchema,
} from './session-feedback-form.schema.js';

interface SessionFeedbackFormProps {
  candidates: SessionFeedbackCandidate[];
  isSubmitting?: boolean;
  onSubmit: (values: SessionFeedbackFormValues) => void | Promise<void>;
}

const DEFAULT_VALUES: SessionFeedbackFormValues = {
  candidateId: '',
  problemSolvingRating: 3,
  communicationRating: 3,
  codeQualityRating: 3,
  debuggingRating: 3,
  overallRating: 3,
  strengths: '',
  improvements: '',
  wouldPairAgain: true,
};

export function SessionFeedbackForm({
  candidates,
  isSubmitting = false,
  onSubmit,
}: SessionFeedbackFormProps) {
  const { t } = useTranslation('feedback');
  const {
    control,
    formState: { errors, isValid },
    getValues,
    handleSubmit,
    register,
    setValue,
  } = useForm<SessionFeedbackFormValues>({
    resolver: zodResolver(sessionFeedbackFormSchema),
    defaultValues: {
      ...DEFAULT_VALUES,
      candidateId: candidates.length === 1 ? (candidates[0]?.userId ?? '') : '',
    },
    mode: 'onChange',
  });
  const singleCandidateId = candidates.length === 1 ? (candidates[0]?.userId ?? null) : null;

  useEffect(() => {
    if (!singleCandidateId || getValues('candidateId')) {
      return;
    }

    setValue('candidateId', singleCandidateId, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    });
  }, [getValues, setValue, singleCandidateId]);

  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardHeader className="border-b border-border/40 px-5 pt-6 pb-5 sm:px-6 sm:pt-7">
        <CardTitle>{t('form.title')}</CardTitle>
        <CardDescription>{t('form.description')}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pt-5 pb-6 sm:px-6 sm:pb-6">
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <Field
            id="candidateId"
            label={t('form.field.candidate')}
            hint={t('form.hint.candidate')}
            error={errors.candidateId?.message}
          >
            <Controller
              control={control}
              name="candidateId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting || candidates.length === 0}
                >
                  <SelectTrigger
                    id="candidateId"
                    aria-invalid={Boolean(errors.candidateId)}
                    className={getInputClassName(Boolean(errors.candidateId))}
                  >
                    <SelectValue placeholder={t('form.placeholder.candidate')} />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((candidate) => (
                      <SelectItem value={candidate.userId} key={candidate.userId}>
                        {candidate.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <RatingField
              control={control}
              name="problemSolvingRating"
              label={t('form.rating.problemSolving')}
              hint={t('form.ratingHint.problemSolving')}
            />
            <RatingField
              control={control}
              name="communicationRating"
              label={t('form.rating.communication')}
              hint={t('form.ratingHint.communication')}
            />
            <RatingField
              control={control}
              name="codeQualityRating"
              label={t('form.rating.codeQuality')}
              hint={t('form.ratingHint.codeQuality')}
            />
            <RatingField
              control={control}
              name="debuggingRating"
              label={t('form.rating.debugging')}
              hint={t('form.ratingHint.debugging')}
            />
          </div>

          <RatingField
            control={control}
            name="overallRating"
            label={t('form.rating.overall')}
            hint={t('form.ratingHint.overall')}
          />

          <Field
            id="strengths"
            label={t('form.field.strengths')}
            hint={t('form.hint.strengths')}
            error={errors.strengths?.message}
          >
            <textarea
              id="strengths"
              aria-invalid={Boolean(errors.strengths)}
              rows={4}
              {...register('strengths')}
              className={getTextareaClassName(Boolean(errors.strengths))}
              placeholder={t('form.placeholder.strengths')}
            />
          </Field>

          <Field
            id="improvements"
            label={t('form.field.improvements')}
            hint={t('form.hint.improvements')}
            error={errors.improvements?.message}
          >
            <textarea
              id="improvements"
              aria-invalid={Boolean(errors.improvements)}
              rows={4}
              {...register('improvements')}
              className={getTextareaClassName(Boolean(errors.improvements))}
              placeholder={t('form.placeholder.improvements')}
            />
          </Field>

          <Controller
            control={control}
            name="wouldPairAgain"
            render={({ field }) => (
              <div className="space-y-2">
                <Label>{t('form.field.wouldPairAgain')}</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[true, false].map((value) => (
                    <button
                      type="button"
                      className={cn(
                        'flex h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors',
                        field.value === value
                          ? 'border-primary/50 bg-primary/15 text-primary'
                          : 'border-border/70 bg-muted/45 text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => field.onChange(value)}
                      aria-pressed={field.value === value}
                      disabled={isSubmitting}
                      key={String(value)}
                    >
                      {field.value === value ? <Check className="size-4" /> : null}
                      {value ? t('form.option.pairAgainYes') : t('form.option.pairAgainNo')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          />

          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={isSubmitting || !isValid} className="w-full sm:w-auto">
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle className="size-4 animate-spin" />
                  {t('form.button.submitting')}
                </span>
              ) : (
                t('form.button.submit')
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RatingField({
  control,
  name,
  label,
  hint,
}: {
  control: Control<SessionFeedbackFormValues>;
  name: keyof Pick<
    SessionFeedbackFormValues,
    | 'problemSolvingRating'
    | 'communicationRating'
    | 'codeQualityRating'
    | 'debuggingRating'
    | 'overallRating'
  >;
  label: string;
  hint: string;
}) {
  const { t } = useTranslation('feedback');

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="space-y-2.5 rounded-md border border-border/60 bg-background/45 p-4">
          <div className="space-y-1">
            <Label>{label}</Label>
            <p className="text-sm text-muted-foreground">{hint}</p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                type="button"
                className={cn(
                  'flex aspect-square min-h-10 items-center justify-center rounded-md border font-mono text-sm font-semibold transition-colors',
                  field.value === rating
                    ? 'border-primary/50 bg-primary/15 text-primary'
                    : 'border-border/70 bg-muted/45 text-muted-foreground hover:text-foreground',
                )}
                aria-label={t('form.ratingAria', { label, rating })}
                aria-pressed={field.value === rating}
                onClick={() => field.onChange(rating)}
                key={rating}
              >
                {rating}
              </button>
            ))}
          </div>
        </div>
      )}
    />
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function getInputClassName(hasError: boolean) {
  return cn(
    'border-border/70 bg-muted/55 focus-visible:border-primary/40 focus-visible:ring-primary/15',
    hasError ? 'border-destructive/60 focus-visible:ring-destructive/15' : '',
  );
}

function getTextareaClassName(hasError: boolean) {
  return cn(
    'min-h-28 flex w-full rounded-md border px-3 py-2.5 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground/80 focus-visible:ring-2',
    getInputClassName(hasError),
  );
}

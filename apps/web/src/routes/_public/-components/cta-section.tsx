import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { FlyingMascots } from './flying-mascots';

export function CtaSection() {
  const { t } = useTranslation('landing');
  return (
    <section className="relative overflow-hidden bg-coral-band py-20 sm:py-28">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 80% at 70% 50%, oklch(0.82 0.18 165 / 0.06), transparent)',
        }}
      />

      {/* Firefly mascots flying around the section */}
      <FlyingMascots />

      <div className="relative z-20 mx-auto max-w-7xl px-6">
        {/* ── Desktop: split layout ── */}
        <div className="relative z-20 hidden items-center lg:grid lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_440px]">
          {/* Left: headline + CTA */}
          <div>
            <motion.h2
              className="font-display font-bold uppercase leading-[0.9] tracking-tight text-white"
              style={{ fontSize: 'clamp(4rem, 10vw, 9rem)' }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              {t('cta.headingLine1')}
              <br />
              <span className="text-coral">{t('cta.headingLine2')}</span>
            </motion.h2>

            <motion.p
              className="mt-6 max-w-md text-lg leading-relaxed text-white/40"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              {t('cta.sub')}
            </motion.p>

            <motion.div
              className="mt-10"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                to="/register"
                className="group inline-flex items-center gap-3 rounded-full bg-white px-8 py-4 text-base font-semibold text-ink transition-shadow hover:shadow-lg-flat sm:text-lg"
              >
                <span className="btn-text-holder">
                  <span className="btn-text-main flex items-center gap-2">
                    {t('cta.getStarted')}
                    <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="btn-text-hover flex items-center gap-2" aria-hidden="true">
                    {t('cta.getStartedHover')}
                    <ArrowRight className="size-5" />
                  </span>
                </span>
              </Link>
            </motion.div>
          </div>

          {/* Right: empty space where mascot flies */}
          <div className="relative" style={{ minHeight: 300 }} />
        </div>

        {/* ── Mobile: stacked ── */}
        <div className="relative z-20 flex flex-col items-center text-center lg:hidden">
          <motion.h2
            className="font-display font-bold uppercase leading-[0.9] tracking-tight text-white"
            style={{ fontSize: 'clamp(3rem, 15vw, 5rem)' }}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {t('cta.headingLine1')}
            <br />
            <span className="text-coral">{t('cta.headingLine2')}</span>
          </motion.h2>

          <motion.p
            className="mt-6 max-w-sm text-base leading-relaxed text-white/40"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {t('cta.sub')}
          </motion.p>

          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              to="/register"
              className="group inline-flex items-center gap-3 rounded-full bg-white px-8 py-4 text-base font-semibold text-ink transition-shadow hover:shadow-lg-flat"
            >
              {t('cta.getStarted')}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

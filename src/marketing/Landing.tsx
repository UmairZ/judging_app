import { useState } from 'react';
import type { FormEvent } from 'react';
import './marketing.css';
import { arabic, C } from '../ui/theme';
import StarDivider from './StarDivider';
import DemoGrading from './DemoGrading';
import { submitWaitlist } from './waitlist';
import { Main } from './vendor/elements/main';
import { Section } from './vendor/elements/section';
import { EmailSignupForm } from './vendor/elements/email-signup-form';
import { ArrowNarrowRightIcon } from './vendor/icons/arrow-narrow-right-icon';
import {
  NavbarLink,
  NavbarLogo,
  NavbarWithLogoActionsAndCenteredLinks,
} from './vendor/sections/navbar-with-logo-actions-and-centered-links';
import { HeroWithDemoOnBackground } from './vendor/sections/hero-with-demo-on-background';
import { Features, FeatureThreeColumnWithDemos } from './vendor/sections/features-three-column-with-demos';
import { TestimonialLargeQuote } from './vendor/sections/testimonial-with-large-quote';
import { FAQsTwoColumnAccordion, Faq } from './vendor/sections/faqs-two-column-accordion';
import { CallToActionSimple } from './vendor/sections/call-to-action-simple';
import { FooterCategory, FooterLink, FooterWithLinkCategories } from './vendor/sections/footer-with-link-categories';

const GITHUB_URL = 'https://github.com/UmairZ/judging_app';
const SIGNIN_HREF = '/?signin=1';

/** Request-invite form: the EmailSignupForm wired to submitWaitlist, with a
 * confirmation message replacing the form on success. Shared by the hero and
 * the closing CTA — same component, same copy, per the brief. */
function RequestInviteForm({ className }: { className?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // EmailSignupForm's <input> carries no `name` attribute (it's a vendored
    // element we don't modify), so read the value directly off the field.
    const input = e.currentTarget.querySelector<HTMLInputElement>('input[type="email"]');
    const email = input?.value ?? '';
    setState('busy');
    setError('');
    try {
      await submitWaitlist({ email });
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — try again.');
      setState('idle');
    }
  };

  if (state === 'done') {
    return (
      <p className={className} style={{ fontSize: 15, color: C.greenDeep, fontWeight: 600 }}>
        You're on the list — we onboard competitions one at a time.
      </p>
    );
  }

  return (
    <div className={className}>
      <EmailSignupForm
        className="max-w-full"
        placeholder="your@email.com"
        onSubmit={(e) => void submit(e)}
        cta={
          <>
            Request an invite <ArrowNarrowRightIcon />
          </>
        }
      />
      {error && (
        <p style={{ marginTop: 8, fontSize: 13, color: C.fail }}>{error}</p>
      )}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="tw-preflight min-h-screen bg-taupe-100 font-sans antialiased">
      <NavbarWithLogoActionsAndCenteredLinks
        logo={
          <NavbarLogo href="/">
            <span className="font-display text-2xl text-taupe-950">Ubayy.</span>
          </NavbarLogo>
        }
        links={
          <>
            <NavbarLink href="#how">How it works</NavbarLink>
            <NavbarLink href={GITHUB_URL}>Open source</NavbarLink>
          </>
        }
        actions={<NavbarLink href={SIGNIN_HREF}>Sign in</NavbarLink>}
      />

      <Main>
        <HeroWithDemoOnBackground
          eyebrow={
            <div style={{ fontFamily: arabic, fontSize: 20, color: C.gold, direction: 'rtl' }}>بسم الله</div>
          }
          headline="Run your Qur'an competition, end to end"
          subheadline={
            <p>
              Registration to leaderboard: multi-judge scoring, live results, and projector-ready standings — built
              for memorization contests of any size.
            </p>
          }
          cta={<RequestInviteForm />}
          demo={
            <img src="/marketing/hero-scoring.png" alt="The Ubayy scoring screen" width={1200} height={800} />
          }
          footer={
            <p className="text-center text-sm/7 text-taupe-600 dark:text-taupe-500">
              The scoring screen, live at the Ibn Katheer Qur'an Competition.
            </p>
          }
        />

        <StarDivider />

        <Features
          id="how"
          features={
            <>
              <FeatureThreeColumnWithDemos
                demo={
                  <img
                    src="/marketing/feature-judges-join.png"
                    alt="Judges joining a session on their phones"
                    width={1200}
                    height={736}
                  />
                }
                headline="Judges join in seconds"
                subheadline={
                  <p>
                    Each judge scans a code on their own phone — or you hand them a provisioned device.
                    Offline-tolerant: scores sync the moment connectivity returns.
                  </p>
                }
              />
              <FeatureThreeColumnWithDemos
                demo={
                  <img
                    src="/marketing/feature-scoring-holds-up.png"
                    alt="A judge's scoring screen with weighted deductions"
                    width={1200}
                    height={736}
                  />
                }
                headline="Scoring that holds up"
                subheadline={
                  <p>
                    Hifz, tajweed, and voice, weighted your way. Raw deductions are the source of truth — scores
                    recompute instantly, and every change is attributable.
                  </p>
                }
              />
              <FeatureThreeColumnWithDemos
                demo={
                  <img
                    src="/marketing/feature-results.png"
                    alt="A live leaderboard on a projector"
                    width={1200}
                    height={736}
                  />
                }
                headline="Results without spreadsheets"
                subheadline={
                  <p>
                    A live leaderboard and projector mode recomputed from every synced session. Finals night ends
                    with standings, not formulas.
                  </p>
                }
              />
            </>
          }
        />

        <Section
          id="try-it-live"
          headline="Try the judge's screen"
          subheadline={<p>This is the real scoring interface your judges use — not a mockup. Tap the deduction keys.</p>}
        >
          <DemoGrading />
        </Section>

        <StarDivider />

        <TestimonialLargeQuote
          quote={
            <p>
              The Prophet ﷺ told Ubayy ibn Kaʿb that he was the best reciter of his ummah — the Companions called
              him Sayyid al-Qurrāʾ, master of the reciters. This platform carries his name as its standard:
              recitation judged with knowledge, fairness, and love.
            </p>
          }
          img={
            <div
              aria-hidden
              className="flex size-full items-center justify-center bg-taupe-800 text-taupe-300"
            >
              <svg width="24" height="24" viewBox="0 0 18 18">
                <rect x="4" y="4" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.1" />
                <rect
                  x="4"
                  y="4"
                  width="10"
                  height="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  transform="rotate(45 9 9)"
                />
              </svg>
            </div>
          }
          name="Ubayy ibn Ka'b"
          byline="Ubayy began at the Ibn Katheer Qur'an Competition, where its scoring system judged its first live contest."
        />

        <FAQsTwoColumnAccordion headline="Questions &amp; Answers">
          <Faq
            question="When can I sign up?"
            answer="Ubayy is in early access. We onboard competitions one at a time so every organizer gets real support — request an invite and we'll reach out as capacity opens."
          />
          <Faq
            question="Can I run it myself?"
            answer="Yes. Ubayy is open source: clone the repository and deploy it to your own Firebase project. The README covers the whole setup."
          />
          <Faq
            question="How do you handle contestants' data?"
            answer="Competitions are isolated from each other by server-enforced rules, contestant data belongs to your organization, and we collect nothing beyond what your competition needs. A full privacy policy ships before public signup opens."
          />
          <Faq
            question="What does it cost?"
            answer="Free during early access. Paid plans will come later for hosted competitions — self-hosting stays free forever."
          />
        </FAQsTwoColumnAccordion>

        <CallToActionSimple headline="Ready when your competition is." cta={<RequestInviteForm />} />
      </Main>

      <FooterWithLinkCategories
        links={
          <>
            <FooterCategory title="Product">
              <FooterLink href="#how">How it works</FooterLink>
              <FooterLink href="#try-it-live">Try it live</FooterLink>
              <FooterLink href={SIGNIN_HREF}>Sign in</FooterLink>
            </FooterCategory>
            <FooterCategory title="Open source">
              <FooterLink href={GITHUB_URL}>GitHub</FooterLink>
              <FooterLink href={`${GITHUB_URL}#readme`}>Self-hosting guide</FooterLink>
            </FooterCategory>
            <FooterCategory title="Contact">
              <FooterLink href={`${GITHUB_URL}/issues`}>GitHub issues</FooterLink>
            </FooterCategory>
          </>
        }
        fineprint="Ubayy began at the Ibn Katheer Qur'an Competition. © 2026 Ubayy."
      />
    </div>
  );
}

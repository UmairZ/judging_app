import './oatmeal.css';
import { AnnouncementBadge } from './vendor/elements/announcement-badge'
import { ButtonLink, PlainButtonLink, SoftButtonLink } from './vendor/elements/button'
import { EmailSignupForm } from './vendor/elements/email-signup-form'
import { Link } from './vendor/elements/link'
import { Logo, LogoGrid } from './vendor/elements/logo-grid'
import { Main } from './vendor/elements/main'
import { Screenshot } from './vendor/elements/screenshot'
import { ArrowNarrowRightIcon } from './vendor/icons/arrow-narrow-right-icon'
import { ChevronIcon } from './vendor/icons/chevron-icon'
import { CallToActionSimple } from './vendor/sections/call-to-action-simple'
import { FAQsTwoColumnAccordion, Faq } from './vendor/sections/faqs-two-column-accordion'
import { FeatureThreeColumnWithDemos, Features } from './vendor/sections/features-three-column-with-demos'
import { FooterCategory, FooterLink, FooterWithLinkCategories } from './vendor/sections/footer-with-link-categories'
import { HeroWithDemoOnBackground } from './vendor/sections/hero-with-demo-on-background'
import {
  NavbarLink,
  NavbarLogo,
  NavbarWithLogoActionsAndCenteredLinks,
} from './vendor/sections/navbar-with-logo-actions-and-centered-links'
import { Plan, PricingMultiTier } from './vendor/sections/pricing-multi-tier'
import { Stat, StatsWithGraph } from './vendor/sections/stats-with-graph'
import { TestimonialLargeQuote } from './vendor/sections/testimonial-with-large-quote'

export default function Page() {
  return (
    <div className="min-h-screen bg-taupe-100">
      <NavbarWithLogoActionsAndCenteredLinks
        id="navbar"
        links={
          <>
            <NavbarLink href="/">Home</NavbarLink>
            <NavbarLink href="/about">About</NavbarLink>
            <NavbarLink href="#">Docs</NavbarLink>
            <NavbarLink href="#" className="sm:hidden">
              Log in
            </NavbarLink>
          </>
        }
        logo={
          <NavbarLogo href="#">
            <span className="font-display text-[28px]/7 tracking-tight text-taupe-950 dark:text-white">Ubayy.</span>
          </NavbarLogo>
        }
        actions={
          <>
            <PlainButtonLink href="#" className="max-sm:hidden">
              Log in
            </PlainButtonLink>
            <ButtonLink href="#hero">Get started</ButtonLink>
          </>
        }
      />

      <Main>
        {/* Hero */}
        <HeroWithDemoOnBackground
          id="hero"
          eyebrow={
            <AnnouncementBadge href="https://ibnkatheercomp.org" text="Live at the Ibn Katheer Qur'an Competition" cta="Learn more" variant="overlay" />
          }
          headline="Run your Qur'an competition, end to end."
          subheadline={
            <p>
              Registration to leaderboard: multi-judge scoring, live results, and projector-ready standings — built
              for memorization contests of any size.
            </p>
          }
          cta={
            <EmailSignupForm
              className="max-w-full"
              variant="overlay"
              cta={
                <>
                  Request invite <ArrowNarrowRightIcon />
                </>
              }
            />
          }
          demo={
            <>
              <img
                className="bg-white/75 md:hidden dark:hidden"
                src="/marketing/hero-scoring.png"
                alt=""
                width="3440"
                height="1500"
              />
              <img
                className="bg-black/75 not-dark:hidden md:hidden"
                src="/marketing/hero-scoring.png"
                alt=""
                width="3440"
                height="1500"
              />
              <img
                className="bg-white/75 max-md:hidden lg:hidden dark:hidden"
                src="/marketing/hero-scoring.png"
                alt=""
                width="3440"
                height="1500"
              />
              <img
                className="bg-black/75 not-dark:hidden max-md:hidden lg:hidden"
                src="/marketing/hero-scoring.png"
                alt=""
                width="3440"
                height="1500"
              />
              <img
                className="bg-white/75 max-lg:hidden dark:hidden"
                src="/marketing/hero-scoring.png"
                alt=""
                width="3440"
                height="1500"
              />
              <img
                className="bg-black/75 not-dark:hidden max-lg:hidden"
                src="/marketing/hero-scoring.png"
                alt=""
                width="3440"
                height="1500"
              />
            </>
          }
          footer={
            <LogoGrid>
              <Logo>
                <img
                  src="/marketing/logos/ibn-katheer.png"
                  alt="Ibn Katheer Quran Competition"
                  className="max-h-10 w-auto opacity-80 grayscale mix-blend-multiply"
                  width={160}
                  height={40}
                />
              </Logo>
              <Logo>
                <img
                  src="/marketing/logos/bilal-masjid.png"
                  alt="Bilal Masjid, Beaverton Oregon"
                  className="max-h-10 w-auto opacity-80 grayscale mix-blend-multiply"
                  width={114}
                  height={40}
                />
              </Logo>
              <Logo>
                <img
                  src="/marketing/logos/icch.png"
                  alt="Islamic Community Center of Hillsboro"
                  className="max-h-10 w-auto opacity-80 grayscale mix-blend-multiply"
                  width={80}
                  height={40}
                />
              </Logo>
              <Logo style={{ height: '3.25rem' }}>
                <img
                  src="/marketing/logos/as-saber.png"
                  alt="Masjed As-Saber, Islamic Center of Portland"
                  className="w-auto opacity-80 grayscale mix-blend-multiply"
                  width={52}
                  height={52}
                />
              </Logo>
            </LogoGrid>
          }
        />

        {/* Features */}
        <Features
          id="features"
          headline="Everything you need to run a fair, organized competition."
          subheadline={
            <p>
              Registration, judge panels, live scoring, and results — Ubayy handles the whole day, so your team can
              focus on the reciters instead of the spreadsheets.
            </p>
          }
          cta={
            <Link href="/demo">
              See how it works <ArrowNarrowRightIcon />
            </Link>
          }
          features={
            <>
              <FeatureThreeColumnWithDemos
                demo={
                  <Screenshot wallpaper="blue" placement="bottom-right">
                    <img
                      src="/marketing/feature-join.png"
                      alt=""
                      className="bg-white/75 sm:hidden dark:hidden"
                      width={1200}
                      height={736}
                    />
                    <img
                      src="/marketing/feature-join.png"
                      alt=""
                      width={1200}
                      height={736}
                      className="bg-black/75 not-dark:hidden sm:hidden"
                    />
                    <img
                      src="/marketing/feature-join.png"
                      alt=""
                      className="bg-white/75 max-sm:hidden lg:hidden dark:hidden"
                      width={1800}
                      height={736}
                    />
                    <img
                      src="/marketing/feature-join.png"
                      alt=""
                      width={1800}
                      height={736}
                      className="bg-black/75 not-dark:hidden max-sm:hidden lg:hidden"
                    />
                    <img
                      src="/marketing/feature-join.png"
                      alt=""
                      className="bg-white/75 max-lg:hidden dark:hidden"
                      width={1200}
                      height={736}
                    />
                    <img
                      src="/marketing/feature-join.png"
                      alt=""
                      width={1200}
                      height={736}
                      className="bg-black/75 not-dark:hidden max-lg:hidden"
                    />
                  </Screenshot>
                }
                headline="Judges join in seconds"
                subheadline={<p>Each judge scans a code and scores on their own phone — no accounts, no app store, no IT desk.</p>}
              />
              <FeatureThreeColumnWithDemos
                demo={
                  <Screenshot wallpaper="purple" placement="top-left">
                    <img
                      src="/marketing/feature-scoring.png"
                      alt=""
                      className="bg-white/75 sm:hidden dark:hidden"
                      width={1200}
                      height={736}
                    />
                    <img
                      src="/marketing/feature-scoring.png"
                      alt=""
                      width={1200}
                      height={736}
                      className="bg-black/75 not-dark:hidden sm:hidden"
                    />
                    <img
                      src="/marketing/feature-scoring.png"
                      alt=""
                      className="bg-white/75 max-sm:hidden lg:hidden dark:hidden"
                      width={1800}
                      height={736}
                    />
                    <img
                      src="/marketing/feature-scoring.png"
                      alt=""
                      width={1800}
                      height={736}
                      className="bg-black/75 not-dark:hidden max-sm:hidden lg:hidden"
                    />
                    <img
                      src="/marketing/feature-scoring.png"
                      alt=""
                      className="bg-white/75 max-lg:hidden dark:hidden"
                      width={1200}
                      height={736}
                    />
                    <img
                      src="/marketing/feature-scoring.png"
                      alt=""
                      width={1200}
                      height={736}
                      className="bg-black/75 not-dark:hidden max-lg:hidden"
                    />
                  </Screenshot>
                }
                headline="Scoring that holds up"
                subheadline={<p>Raw deductions are the source of truth — scores recompute instantly, and every point can be explained to a parent.</p>}
              />
              <FeatureThreeColumnWithDemos
                demo={
                  <Screenshot wallpaper="brown" placement="bottom-left">
                    <img
                      src="/marketing/feature-results.png"
                      alt=""
                      className="bg-white/75 sm:hidden dark:hidden"
                      width={1200}
                      height={736}
                    />
                    <img
                      src="/marketing/feature-results.png"
                      alt=""
                      width={1200}
                      height={736}
                      className="bg-black/75 not-dark:hidden sm:hidden"
                    />
                    <img
                      src="/marketing/feature-results.png"
                      alt=""
                      className="bg-white/75 max-sm:hidden lg:hidden dark:hidden"
                      width={1800}
                      height={736}
                    />
                    <img
                      src="/marketing/feature-results.png"
                      alt=""
                      className="bg-black/75 not-dark:hidden max-sm:hidden lg:hidden"
                      width={1800}
                      height={736}
                    />
                    <img
                      src="/marketing/feature-results.png"
                      alt=""
                      className="bg-white/75 max-lg:hidden dark:hidden"
                      width={1200}
                      height={736}
                    />
                    <img
                      src="/marketing/feature-results.png"
                      alt=""
                      className="bg-black/75 not-dark:hidden max-lg:hidden"
                      width={1200}
                      height={736}
                    />
                  </Screenshot>
                }
                headline="Finals night, no formulas"
                subheadline={<p>A live leaderboard and projector mode, recomputed from every synced session the moment it lands.</p>}
              />
            </>
          }
        />

        {/* Stats */}
        <StatsWithGraph
          id="stats"
          eyebrow="Built for competition day"
          headline="Venue Wi-Fi is not a scoring strategy."
          subheadline={
            <p>
              Ubayy is offline-first: every tap a judge makes is saved on their device the moment it happens, then
              synced when the connection returns. Gym Wi-Fi can come and go — the scores don't.
            </p>
          }
        >
          <Stat stat="0" text="Scores lost to a dropped connection. Grading, notes, and edits all work with no signal at all." />
          <Stat stat="100%" text="Of the leaderboard recomputed automatically as sessions sync back in. No refresh button, no formulas." />
        </StatsWithGraph>

        {/* Testimonial — disabled for now; re-enable by removing `false && (` and `)` */}
        {false && (
        <TestimonialLargeQuote
          id="testimonial"
          quote={
            <p>
              Ubayy has completely transformed our customer support operations. The blend of AI efficiency and human
              empathy has allowed us to provide exceptional service while significantly reducing costs.
            </p>
          }
          img={
            <img
              src="https://assets.tailwindplus.com/avatars/10.webp?size=160"
              alt=""
              className="not-dark:bg-white/75 dark:bg-black/75"
              width={160}
              height={160}
            />
          }
          name="Jordan Rogers"
          byline="Founder at Anomaly"
        />
        )}

        {/* FAQs */}
        <FAQsTwoColumnAccordion id="faqs" headline="Questions & Answers">
          <Faq
            id="faq-1"
            question="How do I get access?"
            answer="Ubayy is in early access — we're a young product, and we onboard competitions one at a time so every organizer gets real support. Request an invite with your email and we'll reach out as capacity opens."
          />
          <Faq
            id="faq-2"
            question="Can judges really use their own phones?"
            answer="Yes — each judge scans a code and lands straight in their judging queue. No accounts, no downloads, and scoring keeps working even when the venue Wi-Fi doesn't."
          />
          <Faq
            id="faq-3"
            question="What does it cost?"
            answer="Nothing during early access. Paid plans for hosted competitions will come later — and self-hosting the open-source version stays free forever."
          />
          <Faq
            id="faq-4"
            question="Can I run it myself?"
            answer="Yes. Ubayy is open source: clone the repository and deploy it to your own Firebase project. The README walks through the whole setup."
          />
        </FAQsTwoColumnAccordion>

        {/* Pricing — disabled until official pricing exists; re-enable by removing `false && (` and `)` */}
        {false && (
        <PricingMultiTier
          id="pricing"
          headline="Pricing to fit your business needs."
          plans={
            <>
              <Plan
                name="Starter"
                price="$12"
                period="/mo"
                subheadline={<p>Small teams getting started with shared inboxes</p>}
                features={[
                  'Shared inbox for up to 2 mailboxes',
                  'Tagging & assignment',
                  'Private notes',
                  'Automatic replies',
                  'Email support',
                ]}
                cta={
                  <SoftButtonLink href="#" size="lg">
                    Start free trial
                  </SoftButtonLink>
                }
              />
              <Plan
                name="Growth"
                price="$49"
                period="/mo"
                subheadline={<p>Growing teams needing collaboration and insights</p>}
                badge="Most popular"
                features={[
                  'Everything in Starter',
                  'Inbox Agent',
                  'Unlimited mailboxes',
                  'Collision detection',
                  'Snippets and templates',
                  'Reporting dashboard',
                  'Slack integration',
                ]}
                cta={
                  <ButtonLink href="#" size="lg">
                    Start free trial
                  </ButtonLink>
                }
              />
              <Plan
                name="Pro"
                price="$299"
                period="/mo"
                subheadline={<p>Support-focused organizations and larger teams</p>}
                features={[
                  'Everything in Growth',
                  'Custom roles & permissions',
                  'Automation engine',
                  'API access',
                  'SLA tracking',
                  'SSO support',
                  'SOC 2 compliance',
                ]}
                cta={
                  <SoftButtonLink href="#" size="lg">
                    Start free trial
                  </SoftButtonLink>
                }
              />
            </>
          }
        />
        )}

        {/* Call To Action */}
        <CallToActionSimple
          id="call-to-action"
          headline="Ready when your competition is."
          subheadline={
            <p>
              We onboard competitions one at a time, with real support at every step — request an invite and we'll be
              in touch.
            </p>
          }
          cta={
            <div className="flex items-center gap-4">
              <ButtonLink href="#hero" size="lg">
                Request an invite
              </ButtonLink>

              <PlainButtonLink href="/demo" size="lg">
                See it in action <ChevronIcon />
              </PlainButtonLink>
            </div>
          }
        />
      </Main>

      <FooterWithLinkCategories
        id="footer"
        links={
          <>
            {/* Product links hidden until their pages exist — re-enable by removing false && */}
            {false && (
            <FooterCategory title="Product">
              <FooterLink href="#">Features</FooterLink>
              <FooterLink href="#">Pricing</FooterLink>
            </FooterCategory>
            )}
            {/* Company links hidden until their pages exist — re-enable by removing false && */}
            {false && (
            <FooterCategory title="Company">
              <FooterLink href="#">About</FooterLink>
              <FooterLink href="#">Blog</FooterLink>
              <FooterLink href="#">Press Kit</FooterLink>
            </FooterCategory>
            )}
            {/* Resources links hidden until their pages exist — re-enable by removing false && */}
            {false && (
            <FooterCategory title="Resources">
              <FooterLink href="#">Help Center</FooterLink>
              <FooterLink href="#">Docs</FooterLink>
              <FooterLink href="#">Status</FooterLink>
              <FooterLink href="#">Contact</FooterLink>
            </FooterCategory>
            )}
            <FooterCategory title="Legal">
              <FooterLink href="#">Privacy Policy</FooterLink>
              <FooterLink href="#">Terms of Service</FooterLink>
            </FooterCategory>
            <FooterCategory title="Connect">
              {/* X hidden for now */}
              {false && <FooterLink href="#">X</FooterLink>}
              <FooterLink href="https://github.com/UmairZ/judging_app">GitHub</FooterLink>
            </FooterCategory>
          </>
        }
        fineprint="© 2026 Ubayy."
      />
    </div>
  )
}

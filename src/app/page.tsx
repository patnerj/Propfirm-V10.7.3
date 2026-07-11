import Link from 'next/link'
import { MarketingHeader } from '@/components/marketing/header'
import { MarketingFooter } from '@/components/marketing/footer'
import { Button } from '@/components/ui/button'
import { Hero } from '@/components/marketing/hero'
import { LiveStatsStrip } from '@/components/marketing/live-stats-strip'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { ChallengesPreview } from '@/components/marketing/challenges-preview'
import { PlatformFeatures } from '@/components/marketing/platform-features'
import { PayoutsSection } from '@/components/marketing/payouts-section'
import { Testimonials } from '@/components/marketing/testimonials'
import { CTASection } from '@/components/marketing/cta-section'

export default function HomePage() {
  return (
    <>
      <MarketingHeader />
      <main className="relative">
        <Hero />
        <LiveStatsStrip />
        <HowItWorks />
        <ChallengesPreview />
        <PlatformFeatures />
        <PayoutsSection />
        <Testimonials />
        <CTASection />
      </main>
      <MarketingFooter />
    </>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-5 py-10 max-w-2xl mx-auto">
      <h1 className="text-[26px] font-bold text-[#111] mb-1">Privacy Policy</h1>
      <p className="text-[13px] text-[#999] mb-8">Last updated: July 29, 2026</p>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">1. What We Collect</h2>
        <p className="text-[14px] text-[#444] leading-relaxed mb-3">When you use Oodle, we collect:</p>
        <ul className="space-y-2">
          {[
            'Account information: email address, username, display name, profile photo',
            'Content you create: posts, questions, answers, images',
            'Payment information: transaction amounts and status (card details are handled entirely by Stripe — we never see or store them)',
            'Usage data: pages visited, features used, timestamps',
            'Device information: browser type, operating system, IP address',
          ].map((item, i) => (
            <li key={i} className="flex gap-2 text-[14px] text-[#444] leading-relaxed">
              <span className="text-[#999] flex-shrink-0">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">2. How We Use Your Data</h2>
        <ul className="space-y-2">
          {[
            'To operate and improve the Oodle platform',
            'To process payments and transfer earnings to creators',
            'To send you notifications about activity on your account',
            'To detect and prevent fraud, abuse, and prohibited content',
            'To comply with legal obligations',
          ].map((item, i) => (
            <li key={i} className="flex gap-2 text-[14px] text-[#444] leading-relaxed">
              <span className="text-[#999] flex-shrink-0">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">3. Who We Share Data With</h2>
        <ul className="space-y-2">
          {[
            'Stripe — to process payments (governed by Stripe\'s Privacy Policy)',
            'Supabase — our database and authentication provider',
            'Vercel — our hosting provider',
            'Law enforcement — if required by law or to protect user safety',
          ].map((item, i) => (
            <li key={i} className="flex gap-2 text-[14px] text-[#444] leading-relaxed">
              <span className="text-[#999] flex-shrink-0">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-[14px] text-[#444] leading-relaxed mt-3">
          We do not sell your personal data to third parties.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">4. Data Retention</h2>
        <p className="text-[14px] text-[#444] leading-relaxed">
          We retain your data for as long as your account is active. If you delete your
          account, we will delete your personal data within 30 days, except where we are
          required to retain it for legal or financial compliance purposes.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">5. Your Rights</h2>
        <p className="text-[14px] text-[#444] leading-relaxed mb-3">
          Depending on your location, you may have the right to:
        </p>
        <ul className="space-y-2">
          {[
            'Access the personal data we hold about you',
            'Request correction of inaccurate data',
            'Request deletion of your data',
            'Object to or restrict how we process your data',
            'Data portability — receive a copy of your data in a machine-readable format',
          ].map((item, i) => (
            <li key={i} className="flex gap-2 text-[14px] text-[#444] leading-relaxed">
              <span className="text-[#999] flex-shrink-0">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-[14px] text-[#444] leading-relaxed mt-3">
          To exercise any of these rights, email us at{' '}
          <a href="mailto:privacy@useyouroodles.com" className="text-[#111] underline">
            privacy@useyouroodles.com
          </a>
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">6. Cookies</h2>
        <p className="text-[14px] text-[#444] leading-relaxed">
          Oodle uses cookies and similar technologies to keep you logged in and to
          understand how the platform is used. We do not use cookies for advertising.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">7. Security</h2>
        <p className="text-[14px] text-[#444] leading-relaxed">
          All data is encrypted in transit (TLS) and at rest. Authentication is handled
          by Supabase Auth with JWT tokens. Payment data is handled entirely by Stripe
          and is never stored on Oodle's servers.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">8. Children's Privacy</h2>
        <p className="text-[14px] text-[#444] leading-relaxed">
          Oodle is not directed at children under 18. We do not knowingly collect data
          from anyone under 18. If we become aware that a minor has created an account,
          we will delete it immediately.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">9. Contact</h2>
        <p className="text-[14px] text-[#444] leading-relaxed">
          Questions about this Privacy Policy? Contact us at{' '}
          <a href="mailto:privacy@useyouroodles.com" className="text-[#111] underline">
            privacy@useyouroodles.com
          </a>
        </p>
      </section>
    </div>
  )
}

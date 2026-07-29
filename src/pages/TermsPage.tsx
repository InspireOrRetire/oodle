export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white px-5 py-10 max-w-2xl mx-auto">
      <h1 className="text-[26px] font-bold text-[#111] mb-1">Terms of Service</h1>
      <p className="text-[13px] text-[#999] mb-8">Last updated: July 29, 2026</p>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">1. About Oodle</h2>
        <p className="text-[14px] text-[#444] leading-relaxed">
          Oodle is a knowledge and advice marketplace that connects creators with their audience.
          Creators in categories such as fashion, food, travel, fitness, and lifestyle sell
          personalized Q&amp;A responses to their followers via direct messaging. Buyers ask
          a creator a question and pay to unlock the creator's answer. All content exchanged
          on Oodle is professional in nature.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">2. Eligibility</h2>
        <p className="text-[14px] text-[#444] leading-relaxed">
          You must be at least 18 years old to use Oodle. By using the platform you confirm
          that you meet this requirement and that the information you provide is accurate.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">3. Prohibited Content</h2>
        <p className="text-[14px] text-[#444] leading-relaxed mb-3">
          The following content is strictly prohibited on Oodle. Violations may result in
          immediate account termination and reporting to relevant authorities:
        </p>
        <ul className="space-y-2">
          {[
            'Adult, explicit, or sexually suggestive content of any kind',
            'Nudity or content that sexualizes any person',
            'Content involving minors in any sexual or inappropriate context',
            'Gambling, sports betting, or games of chance',
            'Sale or promotion of pharmaceuticals, controlled substances, or illegal drugs',
            'Sale or promotion of firearms, weapons, or ammunition',
            'Financial advice, investment recommendations, or securities-related services without proper licensing',
            'Legal advice or services requiring professional licensure',
            'Medical diagnosis, treatment advice, or healthcare services',
            'Hate speech, harassment, or content targeting individuals based on race, gender, religion, or other protected characteristics',
            'Spam, phishing, scams, or fraudulent offers',
            'Content that violates any applicable law or regulation',
            'Intellectual property infringement',
          ].map((item, i) => (
            <li key={i} className="flex gap-2 text-[14px] text-[#444] leading-relaxed">
              <span className="text-[#999] flex-shrink-0">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">4. Payments</h2>
        <p className="text-[14px] text-[#444] leading-relaxed">
          Payments are processed by Stripe. Oodle charges a 15% platform fee on each
          transaction. The remaining 85% is transferred to the creator's verified Stripe
          account. All sales are final — no refunds are issued for digital content once
          delivered.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">5. Creator Responsibilities</h2>
        <p className="text-[14px] text-[#444] leading-relaxed">
          Creators are solely responsible for the content they deliver. Oodle does not
          endorse, verify, or guarantee the accuracy of any creator's answers. Creators
          must not misrepresent their expertise or deliver content that violates these Terms.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">6. Account Termination</h2>
        <p className="text-[14px] text-[#444] leading-relaxed">
          Oodle reserves the right to suspend or permanently terminate any account that
          violates these Terms, at our sole discretion and without prior notice.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">7. Limitation of Liability</h2>
        <p className="text-[14px] text-[#444] leading-relaxed">
          Oodle is provided "as is." To the maximum extent permitted by law, Oodle is not
          liable for any indirect, incidental, or consequential damages arising from your
          use of the platform.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">8. Changes to These Terms</h2>
        <p className="text-[14px] text-[#444] leading-relaxed">
          We may update these Terms from time to time. Continued use of Oodle after changes
          are posted constitutes acceptance of the new Terms.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">9. Contact</h2>
        <p className="text-[14px] text-[#444] leading-relaxed">
          Questions about these Terms? Contact us at{' '}
          <a href="mailto:support@useyouroodles.com" className="text-[#111] underline">
            support@useyouroodles.com
          </a>
        </p>
      </section>
    </div>
  )
}

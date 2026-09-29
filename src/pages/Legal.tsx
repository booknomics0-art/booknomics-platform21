import { DocPage } from "@/components/DocPage";

const UPDATED = "1 June 2026";
const PRIVACY_UPDATED = "August 11, 2026";

export const Privacy = () => (
  <DocPage
    eyebrow="Legal"
    title="Privacy Policy"
    intro="We take your trust seriously. This page explains, in plain language, what we collect, why we collect it, and the rights you have over your data."
    updated={PRIVACY_UPDATED}
    seo={{
      title: "Privacy Policy | Booknomics",
      description: "Booknomics Privacy Policy — what data we collect, how we use it, our use of cookies and Google AdSense advertising, and your GDPR & CCPA rights.",
      path: "/privacy",
    }}
    sections={[
      {
        id: "data-we-collect",
        title: "What Data We Collect",
        body: (
          <>
            <p>We collect only what's necessary to run a personal, useful product:</p>
            <ul>
              <li><strong>Account info:</strong> your email, display name, language preference, and (optional) profile photo.</li>
              <li><strong>Reading history:</strong> books opened, summaries read, time spent, notes saved, and habits tracked.</li>
              <li><strong>Community activity:</strong> reviews, ratings, comments, and upvotes you publish.</li>
              <li><strong>Referral data:</strong> referral codes used, invited friends who signed up, and unlocked rewards.</li>
              <li><strong>Subscription data:</strong> plan status and payment provider IDs (we never see your card details).</li>
              <li><strong>Technical data:</strong> anonymised analytics — pages viewed, device type, broad region.</li>
            </ul>
          </>
        ),
      },
      {
        id: "how-we-use",
        title: "How We Use Your Data",
        body: (
          <>
            <ul>
              <li>Deliver the core service — your library, dashboard, progress, and notes.</li>
              <li>Personalise recommendations based on what you've read and the paths you've enrolled in.</li>
              <li>Improve the product — fix bugs, prioritise features, measure what's working.</li>
              <li>Manage subscriptions and verify referral rewards.</li>
              <li>Send essential service emails (security, billing). Marketing only with your consent.</li>
            </ul>
            <p>We <strong>never sell your data</strong> to advertisers, brokers, or third parties.</p>
          </>
        ),
      },
      {
        id: "data-security",
        title: "Data Security",
        body: (
          <>
            <p>Your data is protected by industry-standard practices:</p>
            <ul>
              <li>All traffic encrypted in transit via HTTPS / TLS.</li>
              <li>Data at rest encrypted in our managed database.</li>
              <li>Row-level security policies ensure you can only access your own data.</li>
              <li>Authentication handled by a trusted identity provider with bcrypt-hashed credentials.</li>
              <li>Regular backups and least-privilege access for our small team.</li>
            </ul>
          </>
        ),
      },
      {
        id: "user-rights",
        title: "Your Rights",
        body: (
          <>
            <p>You're always in control of your data:</p>
            <ul>
              <li><strong>Access:</strong> request a copy of everything we hold about you.</li>
              <li><strong>Edit:</strong> update your profile, email, and preferences anytime from your dashboard.</li>
              <li><strong>Export:</strong> download your notes archive in a portable format.</li>
              <li><strong>Delete:</strong> request full account deletion — we'll erase your data within 30 days.</li>
              <li><strong>Withdraw consent:</strong> unsubscribe from any non-essential email with one click.</li>
            </ul>
            <p>To exercise any right, email <strong>privacy@booknomics.com</strong>.</p>
            <ul>
              <li>
                <strong>European users (GDPR):</strong> If you are in the European Economic Area or the
                United Kingdom, you have the right to access, correct, export, delete, and restrict the
                processing of your data. Email <strong>privacy@booknomics.com</strong> to exercise any of
                these rights.
              </li>
              <li>
                <strong>California users (CCPA/CPRA):</strong> If you are a California resident, you have
                the right to know what personal data we collect, request deletion, correct inaccuracies,
                and opt out of the sale or sharing of personal data. We do not sell your personal data.
                Exercising these rights will not result in discrimination or different pricing.
              </li>
            </ul>
          </>
        ),
      },
      {
        id: "cookies",
        title: "Cookies & Analytics",
        body: (
          <>
            <p>We use cookies and similar technologies to run the site and understand how it is used:</p>
            <ul>
              <li><strong>Essential cookies:</strong> required for login, authentication, and account security.</li>
              <li><strong>Preference cookies:</strong> remember your language, theme, and dashboard settings.</li>
              <li><strong>Analytics cookies:</strong> anonymised, aggregated usage data via Google Analytics to help us improve the product.</li>
            </ul>
            <p>You can block or delete cookies in your browser settings at any time. Blocking essential cookies will stop you from logging in, but the rest of the site remains usable.</p>
          </>
        ),
      },
      {
        id: "advertising",
        title: "Third-Party Advertising (Google AdSense)",
        body: (
          <>
            <p>We display advertisements served by Google AdSense. Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to this website or other websites on the Internet.</p>
            <ul>
              <li>Google's use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and/or other sites on the Internet.</li>
              <li>You can opt out of personalised advertising at any time by visiting Google Ads Settings: <a href="https://adssettings.google.com" target="_blank" rel="nofollow noopener noreferrer">https://adssettings.google.com</a>.</li>
              <li>You can also opt out of some third-party vendors' cookies by visiting <a href="https://www.aboutads.info" target="_blank" rel="nofollow noopener noreferrer">www.aboutads.info</a>.</li>
              <li>Advertising cookies do not give us access to your personal data. We never sell personal data to anyone, including advertisers.</li>
            </ul>
          </>
        ),
      },
      {
        id: "contact",
        title: "Contact",
        body: (
          <p>Questions or concerns? Reach us at <strong>privacy@booknomics.com</strong> — we respond within 48 hours.</p>
        ),
      },
    ]}
  />
);

export const Terms = () => (
  <DocPage
    eyebrow="Legal"
    title="Terms of Service"
    intro="The agreement between you and Booknomics. By using the site you agree to these terms — written in plain English so they're actually readable."
    updated={UPDATED}
    seo={{
      title: "Terms of Service | Booknomics",
      description: "The terms governing your use of Booknomics — user conduct, intellectual property, account responsibility, subscriptions, and liability.",
      path: "/terms",
    }}
    sections={[
      {
        id: "acceptance",
        title: "Acceptance of Terms",
        body: <p>By creating an account or using Booknomics in any form, you agree to these terms. If you don't agree, please don't use the service.</p>,
      },
      {
        id: "user-conduct",
        title: "User Conduct",
        body: (
          <>
            <p>Booknomics is a thoughtful community of readers. We expect everyone to:</p>
            <ul>
              <li>Engage respectfully in reviews, comments, and discussions.</li>
              <li>Keep contributions honest, on-topic, and free of spam or self-promotion.</li>
              <li>Refrain from harassment, hate speech, or personal attacks of any kind.</li>
              <li>Not impersonate authors, publishers, or other users.</li>
            </ul>
            <p>We may remove content or suspend accounts that violate this.</p>
          </>
        ),
      },
      {
        id: "ip",
        title: "Intellectual Property",
        body: (
          <>
            <p>All summaries, action plans, curated learning paths, illustrations, and editorial commentary on Booknomics are <strong>original works owned by Booknomics</strong>. They are licensed to you for personal, non-commercial use only.</p>
            <p>You may not:</p>
            <ul>
              <li>Republish, resell, or redistribute summaries or action plans.</li>
              <li>Scrape, mirror, or train AI models on our content.</li>
              <li>Remove credit, branding, or links when sharing insights.</li>
            </ul>
            <p>Book titles, author names, and covers belong to their respective publishers and are used under fair-use principles for educational reference.</p>
          </>
        ),
      },
      {
        id: "account",
        title: "Account Responsibility",
        body: (
          <>
            <ul>
              <li>You are responsible for the security of your login credentials.</li>
              <li>Don't share your account; each subscription is for one person.</li>
              <li>Notify us immediately at <strong>security@booknomics.com</strong> if you suspect unauthorised access.</li>
              <li>You must be at least 13 years old to create an account.</li>
            </ul>
          </>
        ),
      },
      {
        id: "subscriptions",
        title: "Subscriptions & Payments",
        body: (
          <>
            <p>Premium plans are billed monthly or annually through our payment provider. You can cancel anytime — access continues to the end of the paid period. Subscriptions are non-refundable except where required by law.</p>
            <p>The site may display third-party advertisements, including ads served by Google AdSense. Advertisements are clearly marked and never influence our editorial choices or book recommendations.</p>
          </>
        ),
      },
      {
        id: "liability",
        title: "Limitation of Liability",
        body: (
          <>
            <p>Booknomics provides educational content "as is". To the maximum extent permitted by law:</p>
            <ul>
              <li>We make no warranties about the accuracy or completeness of any summary.</li>
              <li>We are not liable for decisions you make based on our content — see our Disclaimer.</li>
              <li>Our total liability for any claim is limited to the amount you paid us in the previous 12 months.</li>
              <li>We are not liable for service outages, data loss caused by third-party providers, or force-majeure events.</li>
            </ul>
          </>
        ),
      },
      {
        id: "changes",
        title: "Changes to These Terms",
        body: <p>We may update these terms occasionally. Material changes will be communicated by email or an in-app notice. Continued use of Booknomics after updates means you accept the new terms.</p>,
      },
    ]}
  />
);

export const Disclaimer = () => (
  <DocPage
    eyebrow="Important"
    title="Disclaimer"
    intro="Booknomics is built to inspire action — but with honesty about what we are and what we are not. Please read carefully."
    updated={UPDATED}
    seo={{
      title: "Disclaimer | Booknomics",
      description: "Booknomics summaries are educational, not professional advice. Read our affiliate, accuracy, and content policy disclosures.",
      path: "/disclaimer",
    }}
    sections={[
      {
        id: "not-advice",
        title: "Not Professional Advice",
        body: (
          <>
            <p>The summaries, action plans, and articles on Booknomics are provided for <strong>educational and inspirational purposes only</strong>. They are not a substitute for:</p>
            <ul>
              <li><strong>Financial advice</strong> from a qualified planner or accountant.</li>
              <li><strong>Medical advice</strong> from a licensed physician or therapist.</li>
              <li><strong>Psychological or psychiatric advice</strong> from a mental health professional.</li>
              <li><strong>Legal advice</strong> from a qualified attorney.</li>
            </ul>
            <p>Always consult a qualified professional before making decisions that materially affect your money, health, relationships, or career.</p>
          </>
        ),
      },
      {
        id: "affiliate",
        title: "Affiliate Disclosure",
        body: (
          <>
            <p>Some links on Booknomics — particularly to Amazon — are <strong>affiliate links</strong>. If you purchase the original book through one of these links, we may earn a small commission at no additional cost to you.</p>
            <p>This helps fund the site and our editorial work. It never influences which books we choose or how we summarise them.</p>
          </>
        ),
      },
      {
        id: "accuracy",
        title: "Accuracy of Information",
        body: (
          <>
            <p>We strive for accuracy in every summary, but interpretations can vary and we may not capture every nuance of the original work.</p>
            <ul>
              <li>Summaries reflect our editorial reading of the book.</li>
              <li>We update content when authors release new editions or correct errors.</li>
              <li>Booknomics is not responsible for outcomes resulting from applying ideas from our content.</li>
            </ul>
            <p>Spot something off? Email <strong>editorial@booknomics.com</strong> — we read every message.</p>
          </>
        ),
      },
      {
        id: "fair-use",
        title: "Copyright & Fair Use",
        body: (
          <>
            <p>Book titles, author names, and cover images remain the property of their respective publishers. We use them for identification and reference under fair-use principles (and Section 52 of the Indian Copyright Act, 1957) for the purposes of education, commentary, criticism, and research.</p>
            <p>We always encourage purchasing the original book to support its author.</p>
          </>
        ),
      },
      {
        id: "external-links",
        title: "External Links",
        body: <p>We link to external sites (Amazon, Goodreads, publisher websites). We are not responsible for their content, privacy practices, or terms.</p>,
      },
      {
        id: "rights-holders",
        title: "Rights Holder Contact",
        body: <p>Copyright holders with concerns about specific content can email <strong>legal@booknomics.com</strong>. We respond within 48 hours and remove content if a valid claim is made.</p>,
      },
    ]}
  />
);

export const Copyright = () => (
  <DocPage
    eyebrow="Legal"
    title="Content Policy & Copyright"
    intro="The Booknomics Standard — how we curate books, craft action plans, moderate the community, and respond to copyright concerns."
    updated={UPDATED}
    seo={{
      title: "Content Policy & Copyright | Booknomics",
      description: "The Booknomics Standard for curation, action plans, and community reviews — plus a transparent DMCA process with 48-hour response.",
      path: "/copyright",
    }}
    sections={[
      {
        id: "standard",
        title: "The Booknomics Standard",
        body: (
          <>
            <p>Every piece of content on Booknomics is held to the same editorial bar. We don't publish unless it clears these checks.</p>
          </>
        ),
      },
      {
        id: "curation",
        title: "How We Curate Books",
        body: (
          <>
            <p>We don't try to summarise every book ever written. We choose carefully:</p>
            <ul>
              <li><strong>Proven impact:</strong> at least 5+ years of demonstrable influence or 100k+ thoughtful reviews.</li>
              <li><strong>Actionable substance:</strong> the book must contain ideas the reader can apply, not just appreciate.</li>
              <li><strong>Original thinking:</strong> not derivative of another book already in our library.</li>
              <li><strong>Diverse perspectives:</strong> across categories — wealth, mindset, productivity, relationships, philosophy.</li>
            </ul>
          </>
        ),
      },
      {
        id: "action-plans",
        title: "How We Create Action Plans",
        body: (
          <>
            <p>Every action plan follows the same craft process:</p>
            <ol>
              <li><strong>Distil:</strong> the editorial team extracts the book's core operating system.</li>
              <li><strong>Translate:</strong> ideas are reframed into concrete daily, weekly, and 30-day actions.</li>
              <li><strong>Test:</strong> drafts are reviewed for clarity, realism, and habit-design soundness.</li>
              <li><strong>Localise:</strong> every action plan is rewritten — not auto-translated — for Hindi readers.</li>
            </ol>
          </>
        ),
      },
      {
        id: "community",
        title: "Community Review Guidelines",
        body: (
          <>
            <p>Reviews and discussions on Booknomics should help other readers decide and apply. We expect:</p>
            <ul>
              <li>Honest, specific reviews based on actually reading or applying the summary.</li>
              <li>No spam, affiliate links, or external promotions.</li>
              <li>No personal attacks — disagree with ideas, not people.</li>
              <li>Constructive discussion of how ideas worked (or didn't) in your life.</li>
            </ul>
            <p>Our moderators remove anything that violates these standards.</p>
          </>
        ),
      },
      {
        id: "dmca",
        title: "DMCA & Takedown Process",
        body: (
          <>
            <p>To report copyright infringement, email <strong>legal@booknomics.com</strong> with:</p>
            <ol>
              <li>Your identification (name, address, email, phone).</li>
              <li>The copyrighted work (title, author, publisher, ISBN).</li>
              <li>The exact URL of the allegedly infringing content.</li>
              <li>A good-faith statement that the use is not authorised.</li>
              <li>An accuracy statement under penalty of perjury.</li>
              <li>Your signature (electronic accepted).</li>
            </ol>
            <p><strong>Our response:</strong> acknowledgement within 24 hours, review within 48 hours, action within 72 hours.</p>
            <p>Repeat infringers have their accounts terminated.</p>
          </>
        ),
      },
    ]}
  />
);

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { Logo } from '@/components/brand/logo';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Sproutly collects, uses, stores, shares and protects information — including special protections for children’s data.',
};

/**
 * The full Sproutly Privacy Policy, including the Cancellation and Refund
 * sections. Content mirrors "Sproutly Privacy Policy V1.0", effective
 * 26 July 2026, published by Sproutly Solution Private Limited — the same
 * document the mobile app shows, so the two can never drift.
 *
 * Static: no session needed, and a parent should be able to read it before
 * signing in.
 */
type Block =
  | { kind: 'para'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'subhead'; text: string };

interface Section {
  title: string;
  blocks: Block[];
}

const para = (text: string): Block => ({ kind: 'para', text });
const bullet = (text: string): Block => ({ kind: 'bullet', text });
const subhead = (text: string): Block => ({ kind: 'subhead', text });

const EFFECTIVE_DATE = '26 July 2026';

const SECTIONS: Section[] = [
  {
    title: '1. Introduction',
    blocks: [
      para(
        'This Privacy Policy explains how Sproutly Solution Private Limited (“Sproutly”, “we”, “us”, “our”), the owner and operator of the Sproutly pre-school management application (“App”, “Sproutly”, “Service”), collects, uses, stores, shares, and protects information when pre-schools, teachers, staff, and parents/guardians use the App.',
      ),
      para(
        'Sproutly is designed for use by pre-school institutions to manage admissions, attendance, fee collection, daily activity updates, communication, and related administrative functions, including information relating to children enrolled at partner schools.',
      ),
      para(
        'By registering for, accessing, or using Sproutly, the school administrator, staff member, or parent/guardian agrees to the practices described in this Policy. If you do not agree, please do not use the App.',
      ),
    ],
  },
  {
    title: '2. Definitions',
    blocks: [
      bullet(
        '“School”: the pre-school institution that has subscribed to Sproutly for institutional management.',
      ),
      bullet(
        '“Parent/Guardian”: the verified parent or legal guardian of a child enrolled at a School using Sproutly.',
      ),
      bullet(
        '“Child Data”: any personal data relating to a child under 18 years of age, including a child enrolled at a School.',
      ),
      bullet(
        '“Data Fiduciary”: Sproutly Solution Private Limited, which determines the purpose and means of processing personal data through the App.',
      ),
      bullet(
        '“Data Principal”: the individual to whom the personal data relates (School staff, Parent/Guardian, or, through their guardian, the Child).',
      ),
    ],
  },
  {
    title: '3. Information We Collect',
    blocks: [
      subhead('3.1 Information from School Administrators and Staff'),
      bullet('Name, designation, mobile number, email address, and login credentials'),
      bullet('School name, address, registration details, and branch information'),
      bullet('Staff attendance, role assignments, and payroll-related information (if used)'),
      subhead('3.2 Information from Parents/Guardians'),
      bullet(
        'Name, mobile number, email address, residential address, and relationship to the child',
      ),
      bullet('Identity verification details where required to confirm guardianship'),
      bullet('Payment and billing information for fee transactions'),
      bullet(
        'Communication history with the School through the App (messages, notices, complaints)',
      ),
      subhead(
        '3.3 Child Data (collected only through the School and with verifiable parental consent)',
      ),
      bullet('Child’s name, date of birth, gender, photograph, and enrolled program/class'),
      bullet(
        'Attendance records, daily activity logs, meal/nap updates, and developmental notes shared by teachers',
      ),
      bullet(
        'Health-related information voluntarily shared by parents (allergies, medical conditions) for the child’s safety',
      ),
      bullet(
        'Photographs and short videos captured during school activities, shared only with that child’s own parent/guardian and authorised School staff',
      ),
      subhead('3.4 Automatically Collected Information'),
      bullet('Device type, operating system, App version, and unique device identifiers'),
      bullet('App usage logs, crash reports, and diagnostic data for improving reliability'),
      bullet('IP address and approximate location (city-level) for security and fraud prevention'),
    ],
  },
  {
    title: '4. How We Use Information',
    blocks: [
      bullet(
        'To operate core School management features — admissions, attendance, fee collection, activity updates, and parent-teacher communication',
      ),
      bullet('To process fee payments and issue receipts through our payment gateway partners'),
      bullet(
        'To send essential notifications (attendance alerts, fee reminders, School announcements) via app notifications, SMS, or WhatsApp',
      ),
      bullet(
        'To maintain the safety and security of the App, including preventing unauthorised access to a child’s records',
      ),
      bullet(
        'To comply with legal, regulatory, and educational record-keeping obligations applicable to Schools',
      ),
      bullet(
        'To improve the App through aggregated, anonymised usage analysis — never through profiling or behavioural tracking of children',
      ),
    ],
  },
  {
    title: '5. Children’s Data: Special Protections',
    blocks: [
      para(
        'Sproutly is a business-to-business-to-parent platform — Child Data is provided to us by the School and Parent/Guardian for the specific purpose of school administration, not collected directly from children. In line with the Digital Personal Data Protection Act, 2023 and its 2025 Rules, we apply the following safeguards:',
      ),
      bullet(
        'Verifiable parental consent: Child Data is processed only where the enrolling School has obtained, or facilitates our obtaining, verifiable consent from the child’s parent or lawful guardian at the time of admission/onboarding to the App.',
      ),
      bullet(
        'No tracking or targeted advertising: We do not use Child Data for behavioural monitoring, profiling, or targeted advertising, and Sproutly does not display third-party advertisements to child or parent accounts.',
      ),
      bullet(
        'Purpose limitation: Child Data is used strictly for school administration, safety, and parent communication — never sold, rented, or used for any unrelated commercial purpose.',
      ),
      bullet(
        'Access restriction: A child’s records and photographs are visible only to that child’s own parent/guardian and the authorised staff of their specific School branch.',
      ),
      bullet(
        'Parental rights: A parent/guardian may request access to, correction of, or deletion of their child’s data at any time by contacting the School or Sproutly directly (see Section 15).',
      ),
    ],
  },
  {
    title: '6. How We Share Information',
    blocks: [
      para(
        'We do not sell personal data or Child Data. We share information only in the following circumstances:',
      ),
      bullet(
        'With the School: Staff of the School where the child is enrolled can access relevant records to perform their administrative and educational duties.',
      ),
      bullet(
        'With service providers: Payment gateways (for fee processing), SMS/WhatsApp/cloud hosting providers, strictly under contractual confidentiality obligations and only to the extent necessary to provide the Service.',
      ),
      bullet(
        'For legal compliance: Where required by applicable law, court order, or a lawful request from a government or regulatory authority.',
      ),
      bullet(
        'Business transfers: In the event of a merger, acquisition, or restructuring of Sproutly, with continued protection of data under an equivalent policy.',
      ),
    ],
  },
  {
    title: '7. Data Storage and Security',
    blocks: [
      bullet('Data is stored on secure cloud servers with encryption in transit (HTTPS/TLS) and at rest'),
      bullet(
        'Access to Child Data within Sproutly is restricted to authorised personnel on a need-to-know basis',
      ),
      bullet(
        'Role-based access control ensures School staff can only view data relevant to their own branch/class',
      ),
      bullet(
        'We conduct periodic security reviews and require service providers to maintain comparable safeguards',
      ),
    ],
  },
  {
    title: '8. Data Retention',
    blocks: [
      para(
        'We retain Child Data and Parent/Guardian data for as long as the child is enrolled at the School and using Sproutly, and for a reasonable period thereafter (typically up to 3 years) to comply with educational record-keeping norms, resolve disputes, and meet legal obligations, after which it is securely deleted or anonymised, unless a longer retention period is required by law or requested by the School/parent for record continuity.',
      ),
    ],
  },
  {
    title: '9. Cookies and Similar Technologies',
    blocks: [
      para(
        'The Sproutly web dashboard (used by School administrators) may use essential cookies for login sessions and security. We do not use third-party advertising cookies. Users can control cookie preferences through their browser settings; disabling essential cookies may affect App functionality.',
      ),
    ],
  },
  {
    title: '10. Your Rights',
    blocks: [
      para(
        'Subject to applicable law, School staff and Parents/Guardians (on behalf of themselves and their child) may:',
      ),
      bullet('Request access to the personal data we hold about them or their child'),
      bullet('Request correction of inaccurate or incomplete data'),
      bullet(
        'Request deletion of data, subject to the School’s legitimate record-keeping requirements during active enrolment',
      ),
      bullet(
        'Withdraw consent for optional processing (e.g., optional photo-sharing features) at any time, without affecting core School administration functions',
      ),
      bullet(
        'Raise a grievance with our Grievance Officer (Section 15) if a request is not addressed satisfactorily',
      ),
    ],
  },
  {
    title: '11. Cancellation Policy',
    blocks: [
      subhead('11.1 Cancellation by the School (Subscribing Institution)'),
      bullet(
        'A School may cancel its Sproutly subscription at any time by submitting a written cancellation request to Sproutly via email or the in-app support option',
      ),
      bullet(
        'Cancellation requests must be submitted at least 15 days before the next billing cycle to avoid being charged for the following period',
      ),
      bullet(
        'Upon cancellation, the School will retain access to the App until the end of the current paid billing period, after which access will be disabled',
      ),
      bullet(
        'Schools may export their attendance, fee, and student records for a period of 30 days after cancellation, after which data will be handled as per Section 8 (Data Retention)',
      ),
      subhead('11.2 Cancellation by Parents/Guardians'),
      bullet(
        'Individual parent accounts are linked to their child’s enrolment at a subscribing School and are typically managed through the School (e.g., on withdrawal of the child from the School)',
      ),
      bullet(
        'Where a parent has a separate paid add-on subscription directly with Sproutly (if applicable, e.g., premium features), they may cancel it anytime through their account settings, effective at the end of the current billing cycle',
      ),
      subhead('11.3 Cancellation by Sproutly'),
      para(
        'We reserve the right to suspend or cancel a School’s or user’s access in cases of non-payment beyond the grace period, violation of these policies or our Terms of Service, or misuse of the platform, including any unauthorised handling of Child Data. Where possible, prior written notice will be provided.',
      ),
    ],
  },
  {
    title: '12. Refund Policy',
    blocks: [
      subhead('12.1 Subscription Fees'),
      bullet(
        'Subscription fees paid by Schools are billed monthly, quarterly, or annually as per the plan selected at sign-up',
      ),
      bullet(
        'Fees already paid for the current billing period are non-refundable once the billing period has begun, except as described below',
      ),
      bullet(
        'If a School cancels before a new billing cycle begins, no further charges will apply, but the already-paid current period is not refunded on a pro-rata basis',
      ),
      subhead('12.2 Eligible Refund Situations'),
      bullet(
        'Duplicate or erroneous payment charged due to a technical error on our payment gateway or App — fully refundable upon verification',
      ),
      bullet(
        'Service unavailability: if Sproutly is not accessible for more than 5 consecutive business days due to a fault attributable to Sproutly, an affected School may request a pro-rata credit or refund for that downtime',
      ),
      bullet(
        'Non-delivery of a paid add-on feature that was not activated within 15 days of payment',
      ),
      subhead('12.3 Non-Refundable Situations'),
      bullet('Change of mind after the billing period has started'),
      bullet('Reduced usage or partial use of the App during a billing cycle'),
      bullet('Cancellation initiated due to violation of our Terms of Service'),
      bullet('Third-party payment gateway charges or taxes already remitted to the government'),
      subhead('12.4 Refund Process and Timeline'),
      bullet(
        'Refund requests must be raised in writing within 7 days of the disputed charge, along with transaction details',
      ),
      bullet(
        'Approved refunds will be processed to the original payment method within 7–10 business days',
      ),
      bullet(
        'Sproutly will communicate the outcome of a refund request within 5 business days of receiving it',
      ),
    ],
  },
  {
    title: '13. Third-Party Services',
    blocks: [
      para(
        'Sproutly integrates with third-party payment gateways and communication providers (such as SMS/WhatsApp Business API providers) solely to enable fee collection and notifications. These providers process data under their own privacy policies and applicable contractual safeguards; we encourage Schools and parents to review the relevant third-party policy where linked within the App.',
      ),
    ],
  },
  {
    title: '14. Changes to this Policy',
    blocks: [
      para(
        'We may update this Policy from time to time to reflect changes in our practices, features, or legal requirements, including future amendments to the DPDP Act and Rules. Material changes will be notified to Schools and Parents/Guardians via in-app notice or email at least 15 days before taking effect. Continued use of Sproutly after the effective date constitutes acceptance of the revised Policy.',
      ),
    ],
  },
  {
    title: '15. Grievance Officer and Contact Us',
    blocks: [
      para(
        'In accordance with the Digital Personal Data Protection Act, 2023 and applicable Indian IT Rules, any questions, requests, or grievances regarding this Policy, Child Data, cancellations, or refunds may be directed to:',
      ),
      bullet('Grievance Officer / Data Protection Contact: Sproutly Solution Private Limited'),
      bullet('Address: 504 Shades View Phase II, Kaspate Wasti, Wakad, Pune 411057'),
      bullet('Phone: +91 98193 42824'),
      bullet('Email: contact@sproutly.com'),
      para(
        'We aim to acknowledge all grievances within 48 hours and resolve them within 30 days, in line with applicable regulatory timelines.',
      ),
    ],
  },
  {
    title: '16. Governing Law',
    blocks: [
      para(
        'This Policy is governed by the laws of India, including the Digital Personal Data Protection Act, 2023, the Information Technology Act, 2000, and applicable rules made thereunder. Any disputes shall be subject to the exclusive jurisdiction of the courts at Pune, Maharashtra.',
      ),
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-dvh px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        <header className="mb-8">
          <Logo size={34} />
          <h1 className="mt-6 font-display text-3xl font-bold sm:text-4xl">Privacy Policy</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Effective date: {EFFECTIVE_DATE}
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Published and owned by Sproutly Solution Private Limited, Pune.
          </p>
        </header>

        <div className="space-y-8 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-8">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 font-display text-xl font-bold">{section.title}</h2>
              <div className="space-y-2.5">
                {section.blocks.map((block, index) => {
                  if (block.kind === 'subhead') {
                    return (
                      <h3
                        key={index}
                        className="pt-2 font-display text-base font-bold text-[var(--color-text)]"
                      >
                        {block.text}
                      </h3>
                    );
                  }
                  if (block.kind === 'bullet') {
                    return (
                      <p key={index} className="flex gap-2.5 text-sm leading-relaxed">
                        <span
                          className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--color-brand)]"
                          aria-hidden
                        />
                        <span className="text-[var(--color-text-muted)]">{block.text}</span>
                      </p>
                    );
                  }
                  return (
                    <p
                      key={index}
                      className="text-sm leading-relaxed text-[var(--color-text-muted)]"
                    >
                      {block.text}
                    </p>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

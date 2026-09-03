import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/neu.dart';

/// The full Sproutly Privacy Policy (including the Cancellation and Refund
/// policies), rendered from the published v1.0 document.
///
/// Shared across roles — linked from the parent "Privacy & security" sheet and
/// the admin Settings screen. Content mirrors "Sproutly Privacy Policy V1.0",
/// effective 26 July 2026, published by Sproutly Solution Private Limited.
class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key, this.accent = AppColors.brandBlue});

  /// Role accent for section headings and the divider rule.
  final Color accent;

  static const String effectiveDate = '26 July 2026';
  static const String version = 'v1.0';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Privacy Policy'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          Text(
            'Privacy Policy',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: accent,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'including Cancellation Policy and Refund Policy',
            style: TextStyle(
              color: AppColors.textMuted,
              fontStyle: FontStyle.italic,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Effective Date: $effectiveDate\n'
            'Published and owned by Sproutly Solution Private Limited, Pune.',
            style: TextStyle(color: AppColors.textMuted, height: 1.4, fontSize: 12),
          ),
          const SizedBox(height: 20),

          for (final s in _sections) ...[
            _SectionView(section: s, accent: accent),
            const SizedBox(height: 18),
          ],

          const SizedBox(height: 8),
          const Text(
            'Sproutly is a product of Sproutly Solution Private Limited, '
            'Pune, Maharashtra, India.',
            style: TextStyle(
              color: AppColors.textMuted,
              fontStyle: FontStyle.italic,
              fontSize: 12,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Section rendering ──────────────────────────────────────

class _SectionView extends StatelessWidget {
  const _SectionView({required this.section, required this.accent});

  final _Section section;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            section.title,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: accent,
            ),
          ),
          const SizedBox(height: 8),
          for (final block in section.blocks) ...[
            _block(block),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }

  Widget _block(_Block b) {
    switch (b.kind) {
      case _Kind.para:
        return Text(
          b.text,
          style: const TextStyle(color: AppColors.textDark, height: 1.45),
        );
      case _Kind.subhead:
        return Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Text(
            b.text,
            style: const TextStyle(
              color: AppColors.textDark,
              fontWeight: FontWeight.w700,
              fontSize: 13.5,
            ),
          ),
        );
      case _Kind.bullet:
        return Padding(
          padding: const EdgeInsets.only(left: 2),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 7, right: 8),
                child: Container(
                  width: 5,
                  height: 5,
                  decoration: BoxDecoration(
                    color: accent,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  b.text,
                  style: const TextStyle(
                    color: AppColors.textDark,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
        );
    }
  }
}

// ── Content model ──────────────────────────────────────────

enum _Kind { para, subhead, bullet }

class _Block {
  const _Block(this.kind, this.text);
  const _Block.para(this.text) : kind = _Kind.para;
  const _Block.subhead(this.text) : kind = _Kind.subhead;
  const _Block.bullet(this.text) : kind = _Kind.bullet;
  final _Kind kind;
  final String text;
}

class _Section {
  const _Section(this.title, this.blocks);
  final String title;
  final List<_Block> blocks;
}

const List<_Section> _sections = [
  _Section('1. Introduction', [
    _Block.para(
      'This Privacy Policy explains how Sproutly Solution Private Limited '
      '(“Sproutly”, “we”, “us”, “our”), the owner and operator of the '
      'Sproutly pre-school management application (“App”, “Sproutly”, '
      '“Service”), collects, uses, stores, shares, and protects information '
      'when pre-schools, teachers, staff, and parents/guardians use the App.',
    ),
    _Block.para(
      'Sproutly is designed for use by pre-school institutions to manage '
      'admissions, attendance, fee collection, daily activity updates, '
      'communication, and related administrative functions, including '
      'information relating to children enrolled at partner schools.',
    ),
    _Block.para(
      'By registering for, accessing, or using Sproutly, the school '
      'administrator, staff member, or parent/guardian agrees to the practices '
      'described in this Policy. If you do not agree, please do not use the App.',
    ),
  ]),
  _Section('2. Definitions', [
    _Block.bullet(
      '“School”: the pre-school institution that has subscribed to Sproutly '
      'for institutional management.',
    ),
    _Block.bullet(
      '“Parent/Guardian”: the verified parent or legal guardian of a child '
      'enrolled at a School using Sproutly.',
    ),
    _Block.bullet(
      '“Child Data”: any personal data relating to a child under 18 years of '
      'age, including a child enrolled at a School.',
    ),
    _Block.bullet(
      '“Data Fiduciary”: Sproutly Solution Private Limited, which determines '
      'the purpose and means of processing personal data through the App.',
    ),
    _Block.bullet(
      '“Data Principal”: the individual to whom the personal data relates '
      '(School staff, Parent/Guardian, or, through their guardian, the Child).',
    ),
  ]),
  _Section('3. Information We Collect', [
    _Block.subhead('3.1 Information from School Administrators and Staff'),
    _Block.bullet(
      'Name, designation, mobile number, email address, and login credentials',
    ),
    _Block.bullet(
      'School name, address, registration details, and branch information',
    ),
    _Block.bullet(
      'Staff attendance, role assignments, and payroll-related information '
      '(if used)',
    ),
    _Block.subhead('3.2 Information from Parents/Guardians'),
    _Block.bullet(
      'Name, mobile number, email address, residential address, and '
      'relationship to the child',
    ),
    _Block.bullet(
      'Identity verification details where required to confirm guardianship',
    ),
    _Block.bullet('Payment and billing information for fee transactions'),
    _Block.bullet(
      'Communication history with the School through the App (messages, '
      'notices, complaints)',
    ),
    _Block.subhead(
      '3.3 Child Data (collected only through the School and with verifiable '
      'parental consent)',
    ),
    _Block.bullet(
      'Child\'s name, date of birth, gender, photograph, and enrolled '
      'program/class',
    ),
    _Block.bullet(
      'Attendance records, daily activity logs, meal/nap updates, and '
      'developmental notes shared by teachers',
    ),
    _Block.bullet(
      'Health-related information voluntarily shared by parents (allergies, '
      'medical conditions) for the child\'s safety',
    ),
    _Block.bullet(
      'Photographs and short videos captured during school activities, shared '
      'only with that child\'s own parent/guardian and authorised School staff',
    ),
    _Block.subhead('3.4 Automatically Collected Information'),
    _Block.bullet(
      'Device type, operating system, App version, and unique device '
      'identifiers',
    ),
    _Block.bullet(
      'App usage logs, crash reports, and diagnostic data for improving '
      'reliability',
    ),
    _Block.bullet(
      'IP address and approximate location (city-level) for security and '
      'fraud prevention',
    ),
  ]),
  _Section('4. How We Use Information', [
    _Block.bullet(
      'To operate core School management features — admissions, attendance, '
      'fee collection, activity updates, and parent-teacher communication',
    ),
    _Block.bullet(
      'To process fee payments and issue receipts through our payment gateway '
      'partners',
    ),
    _Block.bullet(
      'To send essential notifications (attendance alerts, fee reminders, '
      'School announcements) via app notifications, SMS, or WhatsApp',
    ),
    _Block.bullet(
      'To maintain the safety and security of the App, including preventing '
      'unauthorised access to a child\'s records',
    ),
    _Block.bullet(
      'To comply with legal, regulatory, and educational record-keeping '
      'obligations applicable to Schools',
    ),
    _Block.bullet(
      'To improve the App through aggregated, anonymised usage analysis — '
      'never through profiling or behavioural tracking of children',
    ),
  ]),
  _Section('5. Children\'s Data: Special Protections', [
    _Block.para(
      'Sproutly is a business-to-business-to-parent platform — Child Data is '
      'provided to us by the School and Parent/Guardian for the specific '
      'purpose of school administration, not collected directly from children. '
      'In line with the Digital Personal Data Protection Act, 2023 and its '
      '2025 Rules, we apply the following safeguards:',
    ),
    _Block.bullet(
      'Verifiable parental consent: Child Data is processed only where the '
      'enrolling School has obtained, or facilitates our obtaining, verifiable '
      'consent from the child\'s parent or lawful guardian at the time of '
      'admission/onboarding to the App.',
    ),
    _Block.bullet(
      'No tracking or targeted advertising: We do not use Child Data for '
      'behavioural monitoring, profiling, or targeted advertising, and '
      'Sproutly does not display third-party advertisements to child or '
      'parent accounts.',
    ),
    _Block.bullet(
      'Purpose limitation: Child Data is used strictly for school '
      'administration, safety, and parent communication — never sold, rented, '
      'or used for any unrelated commercial purpose.',
    ),
    _Block.bullet(
      'Access restriction: A child\'s records and photographs are visible only '
      'to that child\'s own parent/guardian and the authorised staff of their '
      'specific School branch.',
    ),
    _Block.bullet(
      'Parental rights: A parent/guardian may request access to, correction '
      'of, or deletion of their child\'s data at any time by contacting the '
      'School or Sproutly directly (see Section 15).',
    ),
  ]),
  _Section('6. How We Share Information', [
    _Block.para(
      'We do not sell personal data or Child Data. We share information only '
      'in the following circumstances:',
    ),
    _Block.bullet(
      'With the School: Staff of the School where the child is enrolled can '
      'access relevant records to perform their administrative and educational '
      'duties.',
    ),
    _Block.bullet(
      'With service providers: Payment gateways (for fee processing), '
      'SMS/WhatsApp/cloud hosting providers, strictly under contractual '
      'confidentiality obligations and only to the extent necessary to provide '
      'the Service.',
    ),
    _Block.bullet(
      'For legal compliance: Where required by applicable law, court order, or '
      'a lawful request from a government or regulatory authority.',
    ),
    _Block.bullet(
      'Business transfers: In the event of a merger, acquisition, or '
      'restructuring of Sproutly, with continued protection of data under an '
      'equivalent policy.',
    ),
  ]),
  _Section('7. Data Storage and Security', [
    _Block.bullet(
      'Data is stored on secure cloud servers with encryption in transit '
      '(HTTPS/TLS) and at rest',
    ),
    _Block.bullet(
      'Access to Child Data within Sproutly is restricted to authorised '
      'personnel on a need-to-know basis',
    ),
    _Block.bullet(
      'Role-based access control ensures School staff can only view data '
      'relevant to their own branch/class',
    ),
    _Block.bullet(
      'We conduct periodic security reviews and require service providers to '
      'maintain comparable safeguards',
    ),
  ]),
  _Section('8. Data Retention', [
    _Block.para(
      'We retain Child Data and Parent/Guardian data for as long as the child '
      'is enrolled at the School and using Sproutly, and for a reasonable '
      'period thereafter (typically up to 3 years) to comply with educational '
      'record-keeping norms, resolve disputes, and meet legal obligations, '
      'after which it is securely deleted or anonymised, unless a longer '
      'retention period is required by law or requested by the School/parent '
      'for record continuity.',
    ),
  ]),
  _Section('9. Cookies and Similar Technologies', [
    _Block.para(
      'The Sproutly web dashboard (used by School administrators) may use '
      'essential cookies for login sessions and security. We do not use '
      'third-party advertising cookies. Users can control cookie preferences '
      'through their browser settings; disabling essential cookies may affect '
      'App functionality.',
    ),
  ]),
  _Section('10. Your Rights', [
    _Block.para(
      'Subject to applicable law, School staff and Parents/Guardians (on '
      'behalf of themselves and their child) may:',
    ),
    _Block.bullet(
      'Request access to the personal data we hold about them or their child',
    ),
    _Block.bullet('Request correction of inaccurate or incomplete data'),
    _Block.bullet(
      'Request deletion of data, subject to the School\'s legitimate '
      'record-keeping requirements during active enrolment',
    ),
    _Block.bullet(
      'Withdraw consent for optional processing (e.g., optional photo-sharing '
      'features) at any time, without affecting core School administration '
      'functions',
    ),
    _Block.bullet(
      'Raise a grievance with our Grievance Officer (Section 15) if a request '
      'is not addressed satisfactorily',
    ),
  ]),
  _Section('11. Cancellation Policy', [
    _Block.subhead('11.1 Cancellation by the School (Subscribing Institution)'),
    _Block.bullet(
      'A School may cancel its Sproutly subscription at any time by '
      'submitting a written cancellation request to Sproutly via email or the '
      'in-app support option',
    ),
    _Block.bullet(
      'Cancellation requests must be submitted at least 15 days before the '
      'next billing cycle to avoid being charged for the following period',
    ),
    _Block.bullet(
      'Upon cancellation, the School will retain access to the App until the '
      'end of the current paid billing period, after which access will be '
      'disabled',
    ),
    _Block.bullet(
      'Schools may export their attendance, fee, and student records for a '
      'period of 30 days after cancellation, after which data will be handled '
      'as per Section 8 (Data Retention)',
    ),
    _Block.subhead('11.2 Cancellation by Parents/Guardians'),
    _Block.bullet(
      'Individual parent accounts are linked to their child\'s enrolment at a '
      'subscribing School and are typically managed through the School (e.g., '
      'on withdrawal of the child from the School)',
    ),
    _Block.bullet(
      'Where a parent has a separate paid add-on subscription directly with '
      'Sproutly (if applicable, e.g., premium features), they may cancel it '
      'anytime through their account settings, effective at the end of the '
      'current billing cycle',
    ),
    _Block.subhead('11.3 Cancellation by Sproutly'),
    _Block.para(
      'We reserve the right to suspend or cancel a School\'s or user\'s access '
      'in cases of non-payment beyond the grace period, violation of these '
      'policies or our Terms of Service, or misuse of the platform, including '
      'any unauthorised handling of Child Data. Where possible, prior written '
      'notice will be provided.',
    ),
  ]),
  _Section('12. Refund Policy', [
    _Block.subhead('12.1 Subscription Fees'),
    _Block.bullet(
      'Subscription fees paid by Schools are billed monthly, quarterly, or '
      'annually as per the plan selected at sign-up',
    ),
    _Block.bullet(
      'Fees already paid for the current billing period are non-refundable '
      'once the billing period has begun, except as described below',
    ),
    _Block.bullet(
      'If a School cancels before a new billing cycle begins, no further '
      'charges will apply, but the already-paid current period is not refunded '
      'on a pro-rata basis',
    ),
    _Block.subhead('12.2 Eligible Refund Situations'),
    _Block.bullet(
      'Duplicate or erroneous payment charged due to a technical error on our '
      'payment gateway or App — fully refundable upon verification',
    ),
    _Block.bullet(
      'Service unavailability: if Sproutly is not accessible for more than 5 '
      'consecutive business days due to a fault attributable to Sproutly, an '
      'affected School may request a pro-rata credit or refund for that '
      'downtime',
    ),
    _Block.bullet(
      'Non-delivery of a paid add-on feature that was not activated within 15 '
      'days of payment',
    ),
    _Block.subhead('12.3 Non-Refundable Situations'),
    _Block.bullet('Change of mind after the billing period has started'),
    _Block.bullet('Reduced usage or partial use of the App during a billing cycle'),
    _Block.bullet('Cancellation initiated due to violation of our Terms of Service'),
    _Block.bullet(
      'Third-party payment gateway charges or taxes already remitted to the '
      'government',
    ),
    _Block.subhead('12.4 Refund Process and Timeline'),
    _Block.bullet(
      'Refund requests must be raised in writing within 7 days of the disputed '
      'charge, along with transaction details',
    ),
    _Block.bullet(
      'Approved refunds will be processed to the original payment method '
      'within 7–10 business days',
    ),
    _Block.bullet(
      'Sproutly will communicate the outcome of a refund request within 5 '
      'business days of receiving it',
    ),
  ]),
  _Section('13. Third-Party Services', [
    _Block.para(
      'Sproutly integrates with third-party payment gateways and '
      'communication providers (such as SMS/WhatsApp Business API providers) '
      'solely to enable fee collection and notifications. These providers '
      'process data under their own privacy policies and applicable '
      'contractual safeguards; we encourage Schools and parents to review the '
      'relevant third-party policy where linked within the App.',
    ),
  ]),
  _Section('14. Changes to this Policy', [
    _Block.para(
      'We may update this Policy from time to time to reflect changes in our '
      'practices, features, or legal requirements, including future amendments '
      'to the DPDP Act and Rules. Material changes will be notified to Schools '
      'and Parents/Guardians via in-app notice or email at least 15 days '
      'before taking effect. Continued use of Sproutly after the effective '
      'date constitutes acceptance of the revised Policy.',
    ),
  ]),
  _Section('15. Grievance Officer and Contact Us', [
    _Block.para(
      'In accordance with the Digital Personal Data Protection Act, 2023 and '
      'applicable Indian IT Rules, any questions, requests, or grievances '
      'regarding this Policy, Child Data, cancellations, or refunds may be '
      'directed to:',
    ),
    _Block.bullet(
      'Grievance Officer / Data Protection Contact: Sproutly Solution Private '
      'Limited',
    ),
    _Block.bullet(
      'Address: 504 Shades View Phase II, Kaspate Wasti, Wakad, Pune 411057',
    ),
    _Block.bullet('Phone: +91 98193 42824'),
    _Block.bullet('Email: contact@sproutly.com'),
    _Block.para(
      'We aim to acknowledge all grievances within 48 hours and resolve them '
      'within 30 days, in line with applicable regulatory timelines.',
    ),
  ]),
  _Section('16. Governing Law', [
    _Block.para(
      'This Policy is governed by the laws of India, including the Digital '
      'Personal Data Protection Act, 2023, the Information Technology Act, '
      '2000, and applicable rules made thereunder. Any disputes shall be '
      'subject to the exclusive jurisdiction of the courts at Pune, '
      'Maharashtra.',
    ),
  ]),
];

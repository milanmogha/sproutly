import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/models/student.dart';
import '../../../core/network/parent_api.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/neu.dart';
import 'complete_profile_screen.dart';

/// Student Profile screen — a child's school record, backed by real data.
/// Before the parent completes the profile, a CTA prompts them to fill it in.
/// Once completed the view is read-only; changes go through the school admin.
class ParentStudentProfileScreen extends StatefulWidget {
  const ParentStudentProfileScreen({super.key, this.student});

  final Student? student;

  @override
  State<ParentStudentProfileScreen> createState() =>
      _ParentStudentProfileScreenState();
}

class _ParentStudentProfileScreenState
    extends State<ParentStudentProfileScreen> {
  Student? _student;
  SchoolContact? _school;

  @override
  void initState() {
    super.initState();
    // Home passes the selected child in; other entry points (e.g. the More
    // tab) open this screen with no student — fall back to the current
    // selection, and load the roster if even that isn't ready yet.
    _student = widget.student ?? ParentApi.instance.selectedChild.value;
    if (_student == null) _loadStudent();
    ParentApi.instance.getSchoolContact().then((s) {
      if (mounted) setState(() => _school = s);
    });
  }

  /// Loads the parent's children when the screen was opened without one,
  /// then shows the currently selected child (or the first one).
  Future<void> _loadStudent() async {
    final children = await ParentApi.instance.childrenCached();
    if (!mounted) return;
    final selected = ParentApi.instance.selectedChild.value ??
        (children.isNotEmpty ? children.first : null);
    if (selected != null) setState(() => _student = selected);
  }

  Future<void> _openComplete() async {
    final s = _student;
    if (s == null) return;
    final done = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => CompleteProfileScreen(student: s)),
    );
    if (done == true) {
      if (mounted) {
        AppToast.show(context, 'Profile completed', type: ToastType.success);
      }
      await _refresh();
    }
  }

  Future<void> _refresh() async {
    final id = _student?.id;
    if (id == null) return;
    final children = await ParentApi.instance.getMyChildren();
    final updated = children.where((c) => c.id == id).toList();
    if (updated.isNotEmpty && mounted) {
      setState(() => _student = updated.first);
    }
  }

  Future<void> _requestChange() async {
    final s = _student;
    if (s == null) return;
    final controller = TextEditingController();
    final send = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Request a change'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Tell the school admin what needs updating. They\'ll make the '
                'change for you.',
                style: TextStyle(fontSize: 13, color: AppColors.textMuted),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'e.g. Update blood group to B+',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Send')),
        ],
      ),
    );
    if (send != true) return;
    final message = controller.text.trim();
    if (message.length < 3) {
      if (mounted) {
        AppToast.show(context, 'Please describe the change',
            type: ToastType.warning);
      }
      return;
    }
    try {
      await ParentApi.instance.requestProfileChange(s.id, message);
      if (mounted) {
        AppToast.show(context, 'Request sent to the school',
            type: ToastType.success);
      }
    } on DioException {
      if (mounted) {
        AppToast.show(context, 'Could not send request. Try again.',
            type: ToastType.error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final student = _student;
    final name = student?.fullName ?? 'Student';
    final completed = student?.profileCompleted ?? false;
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: Neu.bg,
        body: NestedScrollView(
          headerSliverBuilder: (context, _) => [
            SliverToBoxAdapter(
              child: _ProfileHeader(
                name: name,
                student: student,
                completed: completed,
                onEdit: completed ? _requestChange : _openComplete,
              ),
            ),
            SliverPersistentHeader(
              pinned: true,
              delegate: _TabBarDelegate(
                TabBar(
                  isScrollable: true,
                  tabAlignment: TabAlignment.start,
                  indicatorColor: AppColors.parentPrimary,
                  labelColor: AppColors.parentPrimary,
                  unselectedLabelColor: AppColors.textMuted,
                  labelStyle: const TextStyle(fontWeight: FontWeight.w700),
                  tabs: const [
                    Tab(text: 'Profile'),
                    Tab(text: 'Medical'),
                    Tab(text: 'Contacts'),
                  ],
                ),
              ),
            ),
          ],
          body: TabBarView(
            children: [
              _ProfileTab(student: student),
              _MedicalTab(student: student),
              _ContactsTab(student: student, school: _school),
            ],
          ),
        ),
        bottomNavigationBar: student == null
            ? null
            : _ProfileActionBar(
                completed: completed,
                onComplete: _openComplete,
                onRequestChange: _requestChange,
              ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────
// Bottom action bar: complete CTA (before) or locked note (after)
// ──────────────────────────────────────────────────────────

class _ProfileActionBar extends StatelessWidget {
  const _ProfileActionBar({
    required this.completed,
    required this.onComplete,
    required this.onRequestChange,
  });
  final bool completed;
  final VoidCallback onComplete;
  final VoidCallback onRequestChange;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
        child: completed
            ? Row(
                children: [
                  const Icon(Iconsax.lock, size: 16, color: AppColors.textMuted),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Profile locked. Contact the school to change details.',
                      style:
                          TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                  ),
                  TextButton(
                    onPressed: onRequestChange,
                    child: const Text('Request change'),
                  ),
                ],
              )
            : SizedBox(
                width: double.infinity,
                height: 50,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.parentPrimary,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: onComplete,
                  icon: const Icon(Iconsax.user_edit, size: 18),
                  label: const Text('Complete Profile'),
                ),
              ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────
// Header
// ──────────────────────────────────────────────────────────

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.name,
    required this.completed,
    required this.onEdit,
    this.student,
  });
  final String name;
  final bool completed;
  final VoidCallback onEdit;
  final Student? student;

  @override
  Widget build(BuildContext context) {
    final admPill =
        student != null ? 'Adm. ${student!.admissionNumber}' : '';
    final genderPill = student != null && student!.gender.isNotEmpty
        ? _cap(student!.gender)
        : null;
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppColors.parentTint, Neu.bg],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded,
                        color: AppColors.textDark),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: Icon(completed ? Iconsax.message_question : Iconsax.edit,
                        color: AppColors.textDark),
                    tooltip: completed ? 'Request a change' : 'Complete profile',
                    onPressed: onEdit,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            AnimalAvatar(seed: name, gender: student?.gender, size: 88),
            const SizedBox(height: 12),
            Text(
              name,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              alignment: WrapAlignment.center,
              children: [
                if (genderPill != null) _InfoPill(text: genderPill),
                if (admPill.isNotEmpty) _InfoPill(text: admPill),
                _StatusPill(completed: completed),
              ],
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  static String _cap(String s) =>
      s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.completed});
  final bool completed;
  @override
  Widget build(BuildContext context) {
    final color = completed ? AppColors.success : AppColors.warning;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(completed ? Icons.verified_rounded : Icons.info_outline_rounded,
              size: 13, color: color),
          const SizedBox(width: 4),
          Text(
            completed ? 'Profile complete' : 'Profile incomplete',
            style: TextStyle(
                color: color, fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.parentPrimary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: AppColors.parentPrimary,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────
// Tab: Profile
// ──────────────────────────────────────────────────────────

class _ProfileTab extends StatelessWidget {
  const _ProfileTab({this.student});
  final Student? student;

  @override
  Widget build(BuildContext context) {
    final s = student;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
      children: [
        _SectionHeader(title: 'Child Information', icon: Iconsax.user),
        NeuCard(
          child: Column(
            children: [
              _InfoRow(label: 'Full Name', value: _v(s?.fullName)),
              const _Divider(),
              _InfoRow(label: 'Date of Birth', value: _fmtDate(s?.dateOfBirth)),
              const _Divider(),
              _InfoRow(label: 'Age', value: _age(s?.dateOfBirth)),
              const _Divider(),
              _InfoRow(label: 'Gender', value: _cap(_v(s?.gender))),
              const _Divider(),
              _InfoRow(
                  label: 'Blood Group',
                  value: _v(s?.medicalInfo.bloodGroup)),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _SectionHeader(title: 'School Details', icon: Iconsax.building),
        NeuCard(
          child: Column(
            children: [
              _InfoRow(label: 'Admission No.', value: _v(s?.admissionNumber)),
              const _Divider(),
              _InfoRow(label: 'Status', value: _cap(_v(s?.status))),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _SectionHeader(title: 'Home Address', icon: Iconsax.location),
        NeuCard(
          child: (s?.address != null && !s!.address!.isEmpty)
              ? Text(s.address!.formatted,
                  style: const TextStyle(
                      color: AppColors.textDark,
                      fontSize: 13,
                      height: 1.5))
              : const _EmptyHint('No address added yet'),
        ),
      ],
    );
  }
}

// ──────────────────────────────────────────────────────────
// Tab: Medical
// ──────────────────────────────────────────────────────────

class _MedicalTab extends StatelessWidget {
  const _MedicalTab({this.student});
  final Student? student;

  @override
  Widget build(BuildContext context) {
    final m = student?.medicalInfo ?? const StudentMedicalInfo();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
      children: [
        _SectionHeader(
            title: 'Medical Information',
            icon: Icons.medical_information_rounded),
        NeuCard(
          child: _InfoRow(label: 'Blood Group', value: _v(m.bloodGroup)),
        ),
        const SizedBox(height: 20),
        _SectionHeader(title: 'Allergies', icon: Iconsax.warning_2),
        _ChipsOrEmpty(items: m.allergies, empty: 'No allergies recorded'),
        const SizedBox(height: 20),
        _SectionHeader(title: 'Medical Conditions', icon: Iconsax.document_text),
        _ChipsOrEmpty(items: m.conditions, empty: 'No conditions recorded'),
        const SizedBox(height: 20),
        _SectionHeader(title: 'Medications', icon: Iconsax.health),
        _ChipsOrEmpty(items: m.medications, empty: 'No medications recorded'),
        const SizedBox(height: 20),
        _SectionHeader(title: 'Doctor Details', icon: Iconsax.user_square),
        NeuCard(
          child: (m.physicianName ?? '').isEmpty &&
                  (m.physicianPhone ?? '').isEmpty
              ? const _EmptyHint('No doctor details added')
              : Column(
                  children: [
                    _InfoRow(
                        label: 'Physician', value: _v(m.physicianName)),
                    if ((m.physicianPhone ?? '').isNotEmpty) ...[
                      const _Divider(),
                      _InfoRow(
                        label: 'Phone',
                        value: m.physicianPhone!,
                        valueWidget: _CallButton(phone: m.physicianPhone!),
                      ),
                    ],
                  ],
                ),
        ),
        const SizedBox(height: 20),
        _SectionHeader(title: 'Vaccination Records', icon: Iconsax.shield_tick),
        if (m.vaccinations.isEmpty)
          NeuCard(child: const _EmptyHint('No vaccination records added'))
        else
          ...m.vaccinations.map((v) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _VaccinationCard(vax: v),
              )),
      ],
    );
  }
}

class _VaccinationCard extends StatelessWidget {
  const _VaccinationCard({required this.vax});
  final Vaccination vax;

  @override
  Widget build(BuildContext context) {
    final done = vax.administered;
    final dateLabel = done
        ? (vax.administeredOn != null ? _fmtDate(vax.administeredOn) : 'Given')
        : (vax.dueOn != null ? 'Due ${_fmtDate(vax.dueOn)}' : 'Pending');
    return NeuCard(
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: (done ? AppColors.success : AppColors.warning)
                  .withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Icon(
              done ? Icons.check_rounded : Icons.schedule_rounded,
              size: 18,
              color: done ? AppColors.success : AppColors.warning,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (vax.doseLabel ?? '').isEmpty
                      ? vax.name
                      : '${vax.name} · ${vax.doseLabel}',
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, color: AppColors.textDark),
                ),
                const SizedBox(height: 2),
                Text(dateLabel,
                    style: TextStyle(
                        fontSize: 12,
                        color: done ? AppColors.textMuted : AppColors.warning)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ChipsOrEmpty extends StatelessWidget {
  const _ChipsOrEmpty({required this.items, required this.empty});
  final List<String> items;
  final String empty;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return NeuCard(child: _EmptyHint(empty));
    }
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: items
          .map((t) => Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: AppColors.parentPrimary.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(t,
                    style: const TextStyle(
                        color: AppColors.textDark, fontSize: 13)),
              ))
          .toList(),
    );
  }
}

// ──────────────────────────────────────────────────────────
// Tab: Contacts
// ──────────────────────────────────────────────────────────

class _ContactsTab extends StatelessWidget {
  const _ContactsTab({this.student, this.school});
  final Student? student;
  final SchoolContact? school;

  @override
  Widget build(BuildContext context) {
    final guardians = student?.guardians ?? const [];
    final emergency = student?.emergencyContacts ?? const [];
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
      children: [
        _SectionHeader(title: 'Parent / Guardian Details', icon: Iconsax.people),
        if (guardians.isEmpty)
          NeuCard(child: const _EmptyHint('No guardians added yet'))
        else
          ...guardians.map((g) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _ContactCard(
                  name: g.name,
                  relation: _cap(g.relationship) +
                      (g.isPrimary ? ' (Primary Guardian)' : ''),
                  phone: g.phone,
                  email: g.email,
                  avatar: _initials(g.name),
                  isPrimary: g.isPrimary,
                ),
              )),
        const SizedBox(height: 20),
        _SectionHeader(title: 'Emergency Contacts', icon: Iconsax.call),
        if (emergency.isEmpty)
          NeuCard(child: const _EmptyHint('No emergency contacts added'))
        else
          ...emergency.indexed.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _EmergencyContactCard(
                  name: e.$2.name,
                  relation: e.$2.relationship,
                  phone: e.$2.phone,
                  priority: e.$1 + 1,
                ),
              )),
        const SizedBox(height: 20),
        _SectionHeader(title: 'School Contacts', icon: Iconsax.building),
        NeuCard(
          child: school == null
              ? const _EmptyHint('School details unavailable')
              : Column(
                  children: [
                    _InfoRow(label: 'School', value: _v(school!.name)),
                    if ((school!.phone ?? '').isNotEmpty) ...[
                      const _Divider(),
                      _InfoRow(
                        label: 'Phone',
                        value: school!.phone!,
                        valueWidget: _CallButton(phone: school!.phone!),
                      ),
                    ],
                    if ((school!.email ?? '').isNotEmpty) ...[
                      const _Divider(),
                      _InfoRow(label: 'Email', value: school!.email!),
                    ],
                    if ((school!.address ?? '').isNotEmpty) ...[
                      const _Divider(),
                      _InfoRow(label: 'Address', value: school!.address!),
                    ],
                  ],
                ),
        ),
        const SizedBox(height: 20),
        _SectionHeader(title: 'Help & About', icon: Iconsax.info_circle),
        NeuCard(
          child: Column(
            children: [
              _TappableInfoRow(
                icon: Iconsax.message_question,
                label: 'Frequently Asked Questions',
                onTap: () => _showFaq(context),
              ),
              const _Divider(),
              _TappableInfoRow(
                icon: Iconsax.information,
                label: 'About Sproutly',
                onTap: () => _showAbout(context),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ContactCard extends StatelessWidget {
  const _ContactCard({
    required this.name,
    required this.relation,
    required this.phone,
    required this.email,
    required this.avatar,
    this.isPrimary = false,
  });
  final String name;
  final String relation;
  final String phone;
  final String? email;
  final String avatar;
  final bool isPrimary;

  @override
  Widget build(BuildContext context) {
    return NeuCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppColors.parentPrimary.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              avatar,
              style: const TextStyle(
                color: AppColors.parentPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                            color: AppColors.textDark,
                          )),
                    ),
                    if (isPrimary)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color:
                              AppColors.parentPrimary.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text('Primary',
                            style: TextStyle(
                              color: AppColors.parentPrimary,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            )),
                      ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(relation,
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 12)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Iconsax.call,
                        size: 14, color: AppColors.textMuted),
                    const SizedBox(width: 6),
                    Text(phone,
                        style: const TextStyle(
                            fontSize: 13, color: AppColors.textDark)),
                    const Spacer(),
                    _CallButton(phone: phone),
                  ],
                ),
                if ((email ?? '').isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Iconsax.sms,
                          size: 14, color: AppColors.textMuted),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(email!,
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.textMuted)),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EmergencyContactCard extends StatelessWidget {
  const _EmergencyContactCard({
    required this.name,
    required this.relation,
    required this.phone,
    required this.priority,
  });
  final String name;
  final String relation;
  final String phone;
  final int priority;

  @override
  Widget build(BuildContext context) {
    return NeuCard(
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.14),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              '#$priority',
              style: const TextStyle(
                color: AppColors.danger,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.textDark,
                    )),
                const SizedBox(height: 2),
                Text('$relation · $phone',
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 12)),
              ],
            ),
          ),
          _CallButton(phone: phone, color: AppColors.danger),
        ],
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────
// Shared helpers
// ──────────────────────────────────────────────────────────

String _v(String? s) => (s == null || s.isEmpty) ? '—' : s;

String _cap(String s) =>
    s.isEmpty || s == '—' ? s : '${s[0].toUpperCase()}${s.substring(1)}';

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
  if (parts.isEmpty) return '?';
  return parts.take(2).map((p) => p[0].toUpperCase()).join();
}

const _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ──────────────────────────────────────────────────────────
// Help & About helpers
// ──────────────────────────────────────────────────────────

class _TappableInfoRow extends StatelessWidget {
  const _TappableInfoRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppColors.parentPrimary),
            const SizedBox(width: 12),
            Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textDark)),
            ),
            const Icon(Iconsax.arrow_right_3,
                size: 16, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

void _showFaq(BuildContext context) {
  const faqs = [
    ('How do I pay fees?',
        'Go to Fees → select pending invoice → Pay now.'),
    ('How do I mark my child absent?',
        'Apply via More → Leave Application at least one day prior.'),
    ('How do I see the daily diary?',
        'The diary appears on the Home screen under "Today\'s diary".'),
    ('How do I change my phone number?',
        'Settings → Edit profile → update phone and Save.'),
  ];
  showAppBottomSheet<void>(
    context: context,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Help & FAQ',
              style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark)),
          const SizedBox(height: 8),
          for (final f in faqs) ...[
            const SizedBox(height: 8),
            Text(f.$1,
                style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark)),
            const SizedBox(height: 4),
            Text(f.$2,
                style: const TextStyle(
                    color: AppColors.textMuted, height: 1.4)),
          ],
        ],
      ),
    ),
  );
}

void _showAbout(BuildContext context) {
  showAppBottomSheet<void>(
    context: context,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('About Sproutly',
              style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark)),
          const SizedBox(height: 8),
          const Text('Version 1.1.2'),
          const SizedBox(height: 8),
          const Text(
            'Sproutly is a comprehensive pre-school management platform '
            'that connects parents, teachers, and school administrators. '
            'Track attendance, fees, academics, and daily activities — all in '
            'one place.\n\n'
            'Built with ❤️ for early childhood education.',
            style: TextStyle(color: AppColors.textMuted, height: 1.4),
          ),
        ],
      ),
    ),
  );
}

String _fmtDate(DateTime? d) => d == null
    ? '—'
    : '${d.day.toString().padLeft(2, '0')} ${_months[d.month - 1]} ${d.year}';

String _age(DateTime? dob) {
  if (dob == null) return '—';
  final now = DateTime.now();
  var years = now.year - dob.year;
  var months = now.month - dob.month;
  if (now.day < dob.day) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years <= 0) return '$months month${months == 1 ? '' : 's'}';
  return '$years year${years == 1 ? '' : 's'} $months month${months == 1 ? '' : 's'}';
}

class _EmptyHint extends StatelessWidget {
  const _EmptyHint(this.text);
  final String text;
  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: const TextStyle(
            color: AppColors.textMuted,
            fontSize: 13,
            fontStyle: FontStyle.italic));
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.icon});
  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.parentPrimary),
          const SizedBox(width: 6),
          Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: AppColors.textDark,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.label,
    required this.value,
    this.valueWidget,
  });
  final String label;
  final String value;
  final Widget? valueWidget;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(label,
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 13)),
          ),
          Expanded(
            child: Row(
              children: [
                Expanded(
                  child: Text(value,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textDark,
                        fontSize: 13,
                      )),
                ),
                ?valueWidget,
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();
  @override
  Widget build(BuildContext context) {
    return const Divider(height: 1, color: AppColors.mutedGray);
  }
}

class _CallButton extends StatelessWidget {
  const _CallButton({required this.phone, this.color = AppColors.parentPrimary});
  final String phone;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () =>
          AppToast.show(context, 'Calling $phone…', type: ToastType.info),
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: Icon(Iconsax.call, size: 16, color: color),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────
// Tab bar delegate (pins the tab bar while scrolling)
// ──────────────────────────────────────────────────────────

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  const _TabBarDelegate(this.tabBar);
  final TabBar tabBar;

  @override
  double get minExtent => tabBar.preferredSize.height + 1;
  @override
  double get maxExtent => tabBar.preferredSize.height + 1;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: Neu.bg,
      child: Column(
        children: [
          tabBar,
          const Divider(height: 1, color: AppColors.mutedGray),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _TabBarDelegate oldDelegate) => false;
}

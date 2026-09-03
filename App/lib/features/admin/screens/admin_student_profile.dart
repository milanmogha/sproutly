import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax/iconsax.dart';

import '../../../core/models/student.dart';
import '../../../core/network/admin_api.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neu.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/cards.dart';

/// Full-screen student profile for the Admin role. Shows every stored detail
/// and — via the Edit button — lets an admin correct anything the parent
/// filled in (guardians, emergency contacts, medical info, address) plus the
/// basics. Opened from the students list and from a profile-change-request
/// notification.
class AdminStudentProfileScreen extends StatefulWidget {
  const AdminStudentProfileScreen({super.key, required this.student});

  final Student student;

  @override
  State<AdminStudentProfileScreen> createState() =>
      _AdminStudentProfileScreenState();
}

class _AdminStudentProfileScreenState extends State<AdminStudentProfileScreen> {
  late Student _student;
  List<SchoolClass> _classes = const [];

  @override
  void initState() {
    super.initState();
    _student = widget.student;
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    try {
      final c = await AdminApi.instance.listClasses();
      if (mounted) setState(() => _classes = c);
    } catch (_) {
      // Class names are a nicety here; ignore failures.
    }
  }

  Future<void> _refresh() async {
    try {
      final s = await AdminApi.instance.getStudent(_student.id);
      if (mounted) setState(() => _student = s);
    } catch (_) {
      // Keep showing what we have if the refresh fails.
    }
  }

  String? get _className {
    final id = _student.classId;
    if (id == null || id.isEmpty) return null;
    for (final c in _classes) {
      if (c.id == id) return c.displayName;
    }
    return _student.className;
  }

  Future<void> _openEdit() async {
    final updated = await Navigator.of(context).push<Student>(
      neuRoute(AdminEditStudentScreen(student: _student),
      ),
    );
    if (!mounted) return;
    if (updated != null) {
      setState(() => _student = updated);
      AppToast.show(context, 'Profile updated', type: ToastType.success);
    }
  }

  Future<void> _confirmDelete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete student?'),
        content: Text(
          'This permanently removes ${_student.fullName} and their records. '
          'This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete',
                style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await AdminApi.instance.deleteStudent(_student.id);
      if (!mounted) return;
      // Back to the students list, which refreshes on return.
      Navigator.of(context).pop();
      AppToast.show(context, 'Student deleted', type: ToastType.success);
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = switch (e.response?.statusCode) {
        404 => 'Student not found — it may already be deleted.',
        403 => "You don't have permission to delete students.",
        null => 'Cannot reach the server.',
        _ => 'Error ${e.response?.statusCode}. Try again.',
      };
      AppToast.show(context, msg, type: ToastType.error);
    } catch (_) {
      if (!mounted) return;
      AppToast.show(context, 'Something went wrong. Try again.',
          type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = _student;
    final dob = s.dateOfBirth;
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        foregroundColor: AppColors.textDark,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Student Profile'),
        actions: [
          TextButton.icon(
            onPressed: _openEdit,
            icon: const Icon(Iconsax.edit, size: 18),
            label: const Text('Edit'),
            style:
                TextButton.styleFrom(foregroundColor: AppColors.adminPrimary),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Iconsax.more, size: 20),
            color: Colors.white,
            elevation: 6,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            onSelected: (v) {
              if (v == 'delete') _confirmDelete();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: 'delete',
                child: Row(
                  children: [
                    Icon(Iconsax.trash, size: 18, color: AppColors.danger),
                    SizedBox(width: 10),
                    Text('Delete student',
                        style: TextStyle(color: AppColors.danger)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics()),
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
          children: [
            AppCard(
              child: Row(
                children: [
                  AnimalAvatar(seed: s.fullName, gender: s.gender, size: 60),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(s.fullName,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 18,
                                color: AppColors.textDark)),
                        const SizedBox(height: 4),
                        Text(s.admissionNumber,
                            style: const TextStyle(
                                color: AppColors.textMuted, fontSize: 12)),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          children: [
                            StatusChip(
                              label: _cap(s.status),
                              type: s.status == 'active'
                                  ? ChipType.success
                                  : ChipType.neutral,
                            ),
                            StatusChip(
                              label: s.profileCompleted
                                  ? 'Profile complete'
                                  : 'Profile pending',
                              type: s.profileCompleted
                                  ? ChipType.info
                                  : ChipType.warning,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _Section(
              title: 'Basic Details',
              icon: Iconsax.profile_circle,
              children: [
                _row('Full name', s.fullName),
                _row('Admission no.', s.admissionNumber),
                _row('Date of birth',
                    dob != null ? Formatters.formatDate(dob) : '—'),
                _row('Gender', _cap(s.gender)),
                _row('Class', _className ?? 'Not assigned'),
                _row('Status', _cap(s.status)),
                _row('Parent app',
                    s.parentUserId != null ? 'Account active' : 'No account'),
              ],
            ),
            const SizedBox(height: 16),
            _Section(
              title: 'Parents / Guardians',
              icon: Iconsax.people,
              children: s.guardians.isEmpty
                  ? const [_EmptyLine('No guardians on record.')]
                  : [
                      for (final g in s.guardians)
                        _PersonRow(
                          name: g.name,
                          subtitle:
                              '${_cap(g.relationship)}${g.isPrimary ? ' · Primary' : ''}',
                          phone: g.phone,
                          extra:
                              (g.occupation ?? '').isEmpty ? null : g.occupation,
                        ),
                    ],
            ),
            const SizedBox(height: 16),
            _Section(
              title: 'Emergency Contacts',
              icon: Iconsax.call,
              children: s.emergencyContacts.isEmpty
                  ? const [_EmptyLine('No emergency contacts on record.')]
                  : [
                      for (final c in s.emergencyContacts)
                        _PersonRow(
                          name: c.name,
                          subtitle: _cap(c.relationship),
                          phone: c.phone,
                        ),
                    ],
            ),
            const SizedBox(height: 16),
            _Section(
              title: 'Medical Information',
              icon: Iconsax.health,
              children: s.medicalInfo.isEmpty
                  ? const [_EmptyLine('No medical information on record.')]
                  : [
                      if ((s.medicalInfo.bloodGroup ?? '').isNotEmpty)
                        _row('Blood group', s.medicalInfo.bloodGroup!),
                      if (s.medicalInfo.allergies.isNotEmpty)
                        _row('Allergies', s.medicalInfo.allergies.join(', ')),
                      if (s.medicalInfo.conditions.isNotEmpty)
                        _row('Conditions', s.medicalInfo.conditions.join(', ')),
                      if (s.medicalInfo.medications.isNotEmpty)
                        _row('Medications',
                            s.medicalInfo.medications.join(', ')),
                      if ((s.medicalInfo.physicianName ?? '').isNotEmpty)
                        _row('Doctor', s.medicalInfo.physicianName!),
                      if ((s.medicalInfo.physicianPhone ?? '').isNotEmpty)
                        _row('Doctor phone', s.medicalInfo.physicianPhone!),
                    ],
            ),
            const SizedBox(height: 16),
            if (s.medicalInfo.vaccinations.isNotEmpty) ...[
              _Section(
                title: 'Vaccinations',
                icon: Iconsax.shield_tick,
                children: [
                  for (final v in s.medicalInfo.vaccinations)
                    _PersonRow(
                      name: v.name,
                      subtitle: v.administered
                          ? (v.administeredOn != null
                              ? 'Given · ${Formatters.formatDate(v.administeredOn!)}'
                              : 'Given')
                          : (v.dueOn != null
                              ? 'Due · ${Formatters.formatDate(v.dueOn!)}'
                              : 'Due'),
                    ),
                ],
              ),
              const SizedBox(height: 16),
            ],
            _Section(
              title: 'Home Address',
              icon: Iconsax.location,
              children: (s.address == null || s.address!.isEmpty)
                  ? const [_EmptyLine('No address on record.')]
                  : [
                      Text(s.address!.formatted,
                          style: const TextStyle(
                              color: AppColors.textDark,
                              fontSize: 14,
                              height: 1.4)),
                    ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 108,
              child: Text(label,
                  style: const TextStyle(
                      color: AppColors.textMuted, fontSize: 13)),
            ),
            Expanded(
              child: Text(value,
                  style: const TextStyle(
                      color: AppColors.textDark,
                      fontSize: 14,
                      fontWeight: FontWeight.w500)),
            ),
          ],
        ),
      );

  static String _cap(String s) =>
      s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.icon,
    required this.children,
  });

  final String title;
  final IconData icon;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Row(
            children: [
              Icon(icon, size: 16, color: AppColors.adminPrimary),
              const SizedBox(width: 6),
              Text(title,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: AppColors.textDark)),
            ],
          ),
        ),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: children,
          ),
        ),
      ],
    );
  }
}

class _EmptyLine extends StatelessWidget {
  const _EmptyLine(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(color: AppColors.textMuted, fontSize: 13));
}

class _PersonRow extends StatelessWidget {
  const _PersonRow({
    required this.name,
    required this.subtitle,
    this.phone,
    this.extra,
  });

  final String name;
  final String subtitle;
  final String? phone;
  final String? extra;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textDark,
                        fontSize: 14)),
                const SizedBox(height: 2),
                Text(subtitle,
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 12)),
                if (extra != null) ...[
                  const SizedBox(height: 2),
                  Text(extra!,
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 12)),
                ],
              ],
            ),
          ),
          if (phone != null && phone!.isNotEmpty)
            Text(phone!,
                style: const TextStyle(
                    color: AppColors.adminPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

// ── Edit form ──────────────────────────────────────────────

/// Admin edit form for a student. Mirrors the parent Complete-Profile form's
/// sections (medical, guardians, emergency, address) and adds the basics
/// (name, DOB, gender, status). Saves via PATCH /students/:id and returns the
/// updated [Student] to the caller.
class AdminEditStudentScreen extends StatefulWidget {
  const AdminEditStudentScreen({super.key, required this.student});

  final Student student;

  @override
  State<AdminEditStudentScreen> createState() => _AdminEditStudentScreenState();
}

class _AdminEditStudentScreenState extends State<AdminEditStudentScreen> {
  static const _bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  static const _relationships = [
    'father', 'mother', 'guardian', 'grandparent', 'sibling', 'other',
  ];
  static const _genders = ['male', 'female', 'other'];
  static const _statuses = [
    'active', 'inactive', 'graduated', 'withdrawn', 'suspended',
  ];

  // Basics
  final _firstNameCtl = TextEditingController();
  final _lastNameCtl = TextEditingController();
  DateTime? _dob;
  String _gender = 'male';
  String _status = 'active';

  // Medical
  String? _bloodGroup;
  bool _hasMedical = false;
  final _allergiesCtl = TextEditingController();
  final _conditionsCtl = TextEditingController();
  final _medicationsCtl = TextEditingController();
  final _physicianNameCtl = TextEditingController();
  final _physicianPhoneCtl = TextEditingController();
  final List<_VaxEntry> _vaccinations = [];

  // Guardians (two cards; first is the primary)
  late final _GuardianForm _g1;
  late final _GuardianForm _g2;

  // Emergency contact (single)
  final _emgNameCtl = TextEditingController();
  final _emgRelationCtl = TextEditingController();
  final _emgPhoneCtl = TextEditingController();

  // Address
  final _line1Ctl = TextEditingController();
  final _cityCtl = TextEditingController();
  final _stateCtl = TextEditingController();
  final _postalCtl = TextEditingController();

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final s = widget.student;
    _firstNameCtl.text = s.firstName;
    _lastNameCtl.text = s.lastName;
    _dob = s.dateOfBirth;
    _gender = _genders.contains(s.gender) ? s.gender : 'male';
    _status = _statuses.contains(s.status) ? s.status : 'active';

    final g0 = s.guardians.isNotEmpty ? s.guardians[0] : null;
    final g1 = s.guardians.length > 1 ? s.guardians[1] : null;
    _g1 = _GuardianForm(
      relationship:
          _relationships.contains(g0?.relationship) ? g0!.relationship : 'father',
      name: g0?.name ?? '',
      phone: _last10(g0?.phone ?? ''),
      occupation: g0?.occupation ?? '',
    );
    _g2 = _GuardianForm(
      relationship:
          _relationships.contains(g1?.relationship) ? g1!.relationship : 'mother',
      name: g1?.name ?? '',
      phone: _last10(g1?.phone ?? ''),
      occupation: g1?.occupation ?? '',
    );

    final e0 =
        s.emergencyContacts.isNotEmpty ? s.emergencyContacts[0] : null;
    _emgNameCtl.text = e0?.name ?? '';
    _emgRelationCtl.text = e0?.relationship ?? '';
    _emgPhoneCtl.text = _last10(e0?.phone ?? '');

    final m = s.medicalInfo;
    _bloodGroup = _bloodGroups.contains(m.bloodGroup) ? m.bloodGroup : null;
    _allergiesCtl.text = m.allergies.join(', ');
    _conditionsCtl.text = m.conditions.join(', ');
    _medicationsCtl.text = m.medications.join(', ');
    _physicianNameCtl.text = m.physicianName ?? '';
    _physicianPhoneCtl.text = _last10(m.physicianPhone ?? '');
    for (final v in m.vaccinations) {
      _vaccinations.add(_VaxEntry(
        name: v.name,
        given: v.administered,
        date: v.administeredOn ?? v.dueOn,
      ));
    }
    _hasMedical = m.allergies.isNotEmpty ||
        m.conditions.isNotEmpty ||
        m.medications.isNotEmpty ||
        (m.physicianName ?? '').isNotEmpty ||
        (m.physicianPhone ?? '').isNotEmpty;

    final a = s.address;
    _line1Ctl.text = a?.line1 ?? '';
    _cityCtl.text = a?.city ?? '';
    _stateCtl.text = a?.state ?? '';
    _postalCtl.text = a?.postalCode ?? '';
  }

  @override
  void dispose() {
    for (final c in [
      _firstNameCtl, _lastNameCtl,
      _allergiesCtl, _conditionsCtl, _medicationsCtl,
      _physicianNameCtl, _physicianPhoneCtl,
      _emgNameCtl, _emgRelationCtl, _emgPhoneCtl,
      _line1Ctl, _cityCtl, _stateCtl, _postalCtl,
    ]) {
      c.dispose();
    }
    _g1.dispose();
    _g2.dispose();
    for (final v in _vaccinations) {
      v.nameCtl.dispose();
    }
    super.dispose();
  }

  static String _last10(String phone) {
    final d = phone.replaceAll(RegExp(r'\D'), '');
    return d.length > 10 ? d.substring(d.length - 10) : d;
  }

  static List<String> _splitList(String raw) => raw
      .split(RegExp(r'[,\n]'))
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .toList();

  bool _validPhone(String p) => RegExp(r'^[6-9]\d{9}$').hasMatch(p);

  void _fail(String message) {
    setState(() => _error = message);
    AppToast.show(context, message, type: ToastType.warning);
  }

  Future<void> _save() async {
    setState(() => _error = null);

    final firstName = _firstNameCtl.text.trim();
    final lastName = _lastNameCtl.text.trim();
    if (firstName.isEmpty || lastName.isEmpty) {
      _fail('First and last name are required.');
      return;
    }
    if (_dob == null) {
      _fail('Select the date of birth.');
      return;
    }

    // Guardians — a card counts only when it has a name; validate those.
    final guardians = <StudentGuardian>[];
    for (final (i, g) in [_g1, _g2].indexed) {
      final name = g.nameCtl.text.trim();
      final phone = g.phoneCtl.text.trim();
      if (name.isEmpty && phone.isEmpty) continue;
      if (name.isEmpty || !_validPhone(phone)) {
        _fail('Enter a name and a valid 10-digit phone for each guardian.');
        return;
      }
      guardians.add(StudentGuardian(
        name: name,
        relationship: g.relationship,
        phone: phone,
        occupation: g.occupationCtl.text.trim(),
        isPrimary: i == 0,
      ));
    }

    // Emergency contact — all three fields required if any is filled.
    final en = _emgNameCtl.text.trim();
    final er = _emgRelationCtl.text.trim();
    final ep = _emgPhoneCtl.text.trim();
    final emgTouched = en.isNotEmpty || er.isNotEmpty || ep.isNotEmpty;
    final emergency = <EmergencyContact>[];
    if (emgTouched) {
      if (en.isEmpty || er.isEmpty || !_validPhone(ep)) {
        _fail('Complete the emergency contact (name, relation, valid phone) '
            'or clear it.');
        return;
      }
      emergency.add(EmergencyContact(name: en, relationship: er, phone: ep));
    }

    final vaccinations = _vaccinations
        .where((e) => e.nameCtl.text.trim().isNotEmpty)
        .map((e) => Vaccination(
              name: e.nameCtl.text.trim(),
              administered: e.given,
              administeredOn: e.given ? e.date : null,
              dueOn: e.given ? null : e.date,
            ))
        .toList();

    final medical = _hasMedical
        ? StudentMedicalInfo(
            bloodGroup: _bloodGroup,
            allergies: _splitList(_allergiesCtl.text),
            conditions: _splitList(_conditionsCtl.text),
            medications: _splitList(_medicationsCtl.text),
            physicianName: _physicianNameCtl.text.trim(),
            physicianPhone: _physicianPhoneCtl.text.trim(),
            vaccinations: vaccinations,
          )
        : StudentMedicalInfo(bloodGroup: _bloodGroup, vaccinations: vaccinations);

    final address = StudentAddress(
      line1: _line1Ctl.text.trim(),
      city: _cityCtl.text.trim(),
      state: _stateCtl.text.trim(),
      postalCode: _postalCtl.text.trim(),
    );

    final body = <String, dynamic>{
      'firstName': firstName,
      'lastName': lastName,
      'dateOfBirth':
          '${_dob!.year}-${_dob!.month.toString().padLeft(2, '0')}-${_dob!.day.toString().padLeft(2, '0')}',
      'gender': _gender,
      'status': _status,
      'medicalInfo': medical.toJson(),
    };
    // Only touch guardians / emergency / address when the form has content,
    // so a blank section is never accidentally wiped from the record.
    if (guardians.isNotEmpty) {
      body['guardians'] = guardians.map((g) => g.toJson()).toList();
    }
    if (emgTouched) {
      body['emergencyContacts'] = emergency.map((c) => c.toJson()).toList();
    }
    if (!address.isEmpty) {
      body['address'] = address.toJson();
    }

    setState(() => _saving = true);
    try {
      final updated =
          await AdminApi.instance.updateStudent(widget.student.id, body);
      if (!mounted) return;
      Navigator.pop(context, updated);
    } on DioException catch (e) {
      final data = e.response?.data;
      final msg = switch (e.response?.statusCode) {
        400 => data is Map && data['message'] is List
            ? (data['message'] as List).join('\n')
            : (data is Map ? data['message']?.toString() : null) ??
                'Please check the details.',
        404 => 'Student not found.',
        null => 'Cannot reach the server.',
        _ => 'Error ${e.response?.statusCode}. Try again.',
      };
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = msg;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = 'Something went wrong. Try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        foregroundColor: AppColors.textDark,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Edit Student'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          _sectionTitle('Basic Details', Iconsax.profile_circle),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: _field(_firstNameCtl, 'First name')),
                    const SizedBox(width: 10),
                    Expanded(child: _field(_lastNameCtl, 'Last name')),
                  ],
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: AppColors.mutedGray),
                  ),
                  leading: const Padding(
                    padding: EdgeInsets.only(left: 12),
                    child: Icon(Iconsax.calendar, size: 20),
                  ),
                  title: Text(
                    _dob != null
                        ? '${_dob!.day}/${_dob!.month}/${_dob!.year}'
                        : 'Date of birth',
                    style: TextStyle(
                        color: _dob != null
                            ? AppColors.textDark
                            : AppColors.textMuted),
                  ),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _dob ??
                          DateTime.now()
                              .subtract(const Duration(days: 365 * 3)),
                      firstDate: DateTime(2005),
                      lastDate: DateTime.now(),
                    );
                    if (picked != null) setState(() => _dob = picked);
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _gender,
                  decoration: _dec('Gender'),
                  items: _genders
                      .map((g) => DropdownMenuItem(
                          value: g, child: Text(_cap(g))))
                      .toList(),
                  onChanged: (v) => setState(() => _gender = v ?? _gender),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _status,
                  decoration: _dec('Status'),
                  items: _statuses
                      .map((s) => DropdownMenuItem(
                          value: s, child: Text(_cap(s))))
                      .toList(),
                  onChanged: (v) => setState(() => _status = v ?? _status),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _sectionTitle('Medical Information', Iconsax.health),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: _bloodGroup,
                  decoration: _dec('Blood group'),
                  items: _bloodGroups
                      .map((b) =>
                          DropdownMenuItem(value: b, child: Text(b)))
                      .toList(),
                  onChanged: (v) => setState(() => _bloodGroup = v),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<bool>(
                  initialValue: _hasMedical,
                  decoration: _dec('Any allergies, conditions or medication?'),
                  items: const [
                    DropdownMenuItem(value: false, child: Text('No')),
                    DropdownMenuItem(value: true, child: Text('Yes')),
                  ],
                  onChanged: (v) => setState(() => _hasMedical = v ?? false),
                ),
                const SizedBox(height: 12),
                _field(_allergiesCtl, 'Allergies (comma separated)',
                    enabled: _hasMedical),
                const SizedBox(height: 12),
                _field(_conditionsCtl, 'Medical conditions (comma separated)',
                    enabled: _hasMedical),
                const SizedBox(height: 12),
                _field(_medicationsCtl, 'Medications (comma separated)',
                    enabled: _hasMedical),
                const SizedBox(height: 12),
                _field(_physicianNameCtl, 'Doctor / pediatrician name',
                    enabled: _hasMedical),
                const SizedBox(height: 12),
                _phoneField(_physicianPhoneCtl, 'Doctor phone',
                    enabled: _hasMedical),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _sectionTitle('Vaccinations (optional)', Iconsax.shield_tick),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (int i = 0; i < _vaccinations.length; i++) _vaxRow(i),
                if (_vaccinations.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 4),
                    child: Text('No vaccinations added yet.',
                        style: TextStyle(
                            color: AppColors.textMuted, fontSize: 12)),
                  ),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: () =>
                        setState(() => _vaccinations.add(_VaxEntry())),
                    icon: const Icon(Iconsax.add, size: 18),
                    label: const Text('Add vaccination'),
                    style: TextButton.styleFrom(
                        foregroundColor: AppColors.adminPrimary),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _sectionTitle('Parent / Guardian', Iconsax.people),
          _guardianCard('Primary guardian', _g1),
          const SizedBox(height: 10),
          _guardianCard('Second guardian (optional)', _g2),
          const SizedBox(height: 20),
          _sectionTitle('Emergency Contact (optional)', Iconsax.call),
          AppCard(
            child: Column(
              children: [
                _field(_emgNameCtl, 'Name'),
                const SizedBox(height: 12),
                _field(_emgRelationCtl, 'Relationship (e.g. Grandmother)'),
                const SizedBox(height: 12),
                _phoneField(_emgPhoneCtl, 'Phone'),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _sectionTitle('Home Address (optional)', Iconsax.location),
          AppCard(
            child: Column(
              children: [
                _field(_line1Ctl, 'Address line'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _field(_cityCtl, 'City')),
                    const SizedBox(width: 10),
                    Expanded(child: _field(_stateCtl, 'State')),
                  ],
                ),
                const SizedBox(height: 12),
                _phoneOptional(_postalCtl, 'PIN code', 6),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!,
                style: const TextStyle(color: AppColors.danger, fontSize: 13)),
          ],
          const SizedBox(height: 24),
          PrimaryButton(
            label: 'Save changes',
            icon: Iconsax.tick_circle,
            color: AppColors.adminPrimary,
            isLoading: _saving,
            onPressed: _saving ? null : _save,
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title, IconData icon) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: [
            Icon(icon, size: 16, color: AppColors.adminPrimary),
            const SizedBox(width: 6),
            Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.textDark)),
          ],
        ),
      );

  Widget _guardianCard(String title, _GuardianForm g) => AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.textDark,
                    fontSize: 13)),
            const SizedBox(height: 12),
            _field(g.nameCtl, 'Full name'),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: g.relationship,
              decoration: _dec('Relationship'),
              items: _relationships
                  .map((r) => DropdownMenuItem(
                        value: r,
                        child: Text(_cap(r)),
                      ))
                  .toList(),
              onChanged: (v) =>
                  setState(() => g.relationship = v ?? 'guardian'),
            ),
            const SizedBox(height: 12),
            _phoneField(g.phoneCtl, 'Phone'),
            const SizedBox(height: 12),
            _field(g.occupationCtl, 'Occupation (optional)'),
          ],
        ),
      );

  InputDecoration _dec(String label) => InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        isDense: true,
      );

  Widget _field(TextEditingController c, String label, {bool enabled = true}) =>
      TextField(
        controller: c,
        enabled: enabled,
        textCapitalization: TextCapitalization.words,
        decoration: _dec(label),
      );

  Widget _phoneField(TextEditingController c, String label,
          {bool enabled = true}) =>
      TextField(
        controller: c,
        enabled: enabled,
        keyboardType: TextInputType.phone,
        maxLength: 10,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: _dec(label).copyWith(counterText: ''),
      );

  Widget _phoneOptional(TextEditingController c, String label, int max) =>
      TextField(
        controller: c,
        keyboardType: TextInputType.number,
        maxLength: max,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: _dec(label).copyWith(counterText: ''),
      );

  Widget _vaxRow(int i) {
    final e = _vaccinations[i];
    final dateText = e.date == null
        ? (e.given ? 'Given on…' : 'Due on…')
        : '${e.date!.day.toString().padLeft(2, '0')}/${e.date!.month.toString().padLeft(2, '0')}/${e.date!.year}';
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: _field(e.nameCtl, 'Vaccine name')),
              IconButton(
                icon: const Icon(Iconsax.trash,
                    size: 18, color: AppColors.danger),
                onPressed: () {
                  setState(() {
                    e.nameCtl.dispose();
                    _vaccinations.removeAt(i);
                  });
                },
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<bool>(
                  initialValue: e.given,
                  decoration: _dec('Status'),
                  items: const [
                    DropdownMenuItem(value: true, child: Text('Given')),
                    DropdownMenuItem(value: false, child: Text('Due')),
                  ],
                  onChanged: (v) => setState(() => e.given = v ?? true),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: AppColors.mutedGray),
                  ),
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: e.date ?? DateTime.now(),
                      firstDate: DateTime(2015),
                      lastDate: DateTime(2030),
                    );
                    if (picked != null) setState(() => e.date = picked);
                  },
                  child: Text(dateText,
                      style: const TextStyle(
                          color: AppColors.textDark, fontSize: 13)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _cap(String s) =>
      s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';
}

/// Mutable holder for one vaccination row.
class _VaxEntry {
  _VaxEntry({String name = '', this.given = true, this.date})
      : nameCtl = TextEditingController(text: name);

  final TextEditingController nameCtl;
  bool given;
  DateTime? date;
}

/// Mutable holder for one guardian card's controllers + relationship.
class _GuardianForm {
  _GuardianForm({
    required this.relationship,
    String name = '',
    String phone = '',
    String occupation = '',
  })  : nameCtl = TextEditingController(text: name),
        phoneCtl = TextEditingController(text: phone),
        occupationCtl = TextEditingController(text: occupation);

  String relationship;
  final TextEditingController nameCtl;
  final TextEditingController phoneCtl;
  final TextEditingController occupationCtl;

  void dispose() {
    nameCtl.dispose();
    phoneCtl.dispose();
    occupationCtl.dispose();
  }
}

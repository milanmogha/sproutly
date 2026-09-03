import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax/iconsax.dart';

import '../../../core/models/student.dart';
import '../../../core/network/parent_api.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/neu.dart';

/// One-time "Complete Profile" form for a parent. Captures the schema-backed
/// details the admin did not enter (medical, guardians, emergency contacts,
/// address). On submit the profile locks server-side.
class CompleteProfileScreen extends StatefulWidget {
  const CompleteProfileScreen({super.key, required this.student});

  final Student student;

  @override
  State<CompleteProfileScreen> createState() => _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends State<CompleteProfileScreen> {
  static const _bloodGroups = [
    'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
  ];
  static const _relationships = ['father', 'mother', 'guardian'];

  // Medical
  String? _bloodGroup;
  // Gate: does the child have any medical conditions / allergies / medication?
  // When 'no', the detail fields below are disabled and ignored on submit.
  bool _hasMedical = false;
  final _allergiesCtl = TextEditingController();
  final _conditionsCtl = TextEditingController();
  final _medicationsCtl = TextEditingController();
  final _physicianNameCtl = TextEditingController();
  final _physicianPhoneCtl = TextEditingController();

  // Vaccinations (repeatable, independent of the medical gate)
  final List<_VaxEntry> _vaccinations = [];

  // Guardians (two cards; the first is the primary parent)
  late final _GuardianForm _g1;
  late final _GuardianForm _g2;

  // Emergency contact (single, optional)
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
    // Prefill the primary guardian from what the admin already entered.
    final primary = widget.student.primaryGuardian;
    _g1 = _GuardianForm(
      relationship: _relationships.contains(primary?.relationship)
          ? primary!.relationship
          : 'father',
      name: primary?.name ?? '',
      phone: _last10(primary?.phone ?? ''),
      occupation: primary?.occupation ?? '',
    );
    _g2 = _GuardianForm(relationship: 'mother');
    // Prefill medical if any already exists.
    final m = widget.student.medicalInfo;
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
    // Turn the gate on if any medical detail already exists.
    _hasMedical = m.allergies.isNotEmpty ||
        m.conditions.isNotEmpty ||
        m.medications.isNotEmpty ||
        (m.physicianName ?? '').isNotEmpty ||
        (m.physicianPhone ?? '').isNotEmpty;
    final a = widget.student.address;
    _line1Ctl.text = a?.line1 ?? '';
    _cityCtl.text = a?.city ?? '';
    _stateCtl.text = a?.state ?? '';
    _postalCtl.text = a?.postalCode ?? '';
  }

  @override
  void dispose() {
    for (final c in [
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
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    return digits.length > 10 ? digits.substring(digits.length - 10) : digits;
  }

  static List<String> _splitList(String raw) => raw
      .split(RegExp(r'[,\n]'))
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .toList();

  bool _validPhone(String p) => RegExp(r'^[6-9]\d{9}$').hasMatch(p);

  /// Surfaces a validation problem both inline and as a snackbar, so the
  /// reason the form didn't submit is always visible.
  void _fail(String message) {
    setState(() => _error = message);
    AppToast.show(context, message, type: ToastType.warning);
  }

  Future<void> _submit() async {
    setState(() => _error = null);

    // Build guardians from the two cards; a card counts only if it has a name.
    final guardians = <StudentGuardian>[];
    for (final (i, g) in [_g1, _g2].indexed) {
      final name = g.nameCtl.text.trim();
      final phone = g.phoneCtl.text.trim();
      if (name.isEmpty && phone.isEmpty) continue;
      if (name.isEmpty || !_validPhone(phone)) {
        _fail('Enter a name and a valid 10-digit phone for each parent you add.');
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
    if (guardians.isEmpty) {
      _fail('Add at least one parent / guardian (name + phone).');
      return;
    }

    // Optional emergency contact — all three fields required if any is filled.
    final emergency = <EmergencyContact>[];
    final en = _emgNameCtl.text.trim();
    final er = _emgRelationCtl.text.trim();
    final ep = _emgPhoneCtl.text.trim();
    if (en.isNotEmpty || er.isNotEmpty || ep.isNotEmpty) {
      if (en.isEmpty || er.isEmpty || !_validPhone(ep)) {
        _fail('Complete the emergency contact (name, relation, valid phone) or clear it.');
        return;
      }
      emergency.add(EmergencyContact(name: en, relationship: er, phone: ep));
    }

    // Vaccinations are captured regardless of the medical-conditions gate.
    final vaccinations = _vaccinations
        .where((e) => e.nameCtl.text.trim().isNotEmpty)
        .map((e) => Vaccination(
              name: e.nameCtl.text.trim(),
              administered: e.given,
              administeredOn: e.given ? e.date : null,
              dueOn: e.given ? null : e.date,
            ))
        .toList();

    // Medical: only include the detail fields when the gate is set to "Yes".
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
        : StudentMedicalInfo(
            bloodGroup: _bloodGroup, vaccinations: vaccinations);

    final address = StudentAddress(
      line1: _line1Ctl.text.trim(),
      city: _cityCtl.text.trim(),
      state: _stateCtl.text.trim(),
      postalCode: _postalCtl.text.trim(),
    );

    final confirmed = await _confirm();
    if (confirmed != true) return;

    setState(() => _saving = true);
    try {
      await ParentApi.instance.completeProfile(
        widget.student.id,
        address: address.isEmpty ? null : address,
        guardians: guardians,
        emergencyContacts: emergency,
        medicalInfo: medical,
      );
      if (!mounted) return;
      // Success toast is shown by the screen we return to (context here is
      // being torn down by the pop).
      Navigator.pop(context, true);
    } on DioException catch (e) {
      final msg = switch (e.response?.statusCode) {
        403 => (e.response?.data as Map?)?['message']?.toString() ??
            'Profile already completed.',
        400 => (e.response?.data as Map?)?['message'] is List
            ? ((e.response?.data as Map)['message'] as List).join('\n')
            : (e.response?.data as Map?)?['message']?.toString() ??
                'Please check the details.',
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

  Future<bool?> _confirm() => showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Submit profile?'),
          content: const Text(
            'Once submitted, these details are locked. To change them later '
            'you\'ll need to ask the school admin.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Review'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Submit'),
            ),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        title: const Text('Complete Profile'),
        backgroundColor: Neu.bg,
        foregroundColor: AppColors.textDark,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          Text(
            'Fill in ${widget.student.firstName}\'s details. You can submit this '
            'once, so please review before saving.',
            style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
          ),
          const SizedBox(height: 20),

          _sectionTitle('Medical Information', Iconsax.health),
          NeuCard(
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
                  decoration: _dec(
                      'Any allergies, conditions or medication?'),
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
          NeuCard(
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
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          _sectionTitle('Parent / Guardian', Iconsax.people),
          _guardianCard('Primary parent', _g1),
          const SizedBox(height: 10),
          _guardianCard('Second parent (optional)', _g2),
          const SizedBox(height: 20),

          _sectionTitle('Emergency Contact (optional)', Iconsax.call),
          NeuCard(
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
          NeuCard(
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
            label: 'Submit & Lock Profile',
            icon: Iconsax.tick_circle,
            isLoading: _saving,
            onPressed: _saving ? null : _submit,
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title, IconData icon) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: [
            Icon(icon, size: 16, color: AppColors.parentPrimary),
            const SizedBox(width: 6),
            Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.textDark)),
          ],
        ),
      );

  Widget _guardianCard(String title, _GuardianForm g) => NeuCard(
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
                        child: Text('${r[0].toUpperCase()}${r.substring(1)}'),
                      ))
                  .toList(),
              onChanged: (v) => setState(() => g.relationship = v ?? 'guardian'),
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

  Widget _field(TextEditingController c, String label,
          {bool enabled = true}) =>
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

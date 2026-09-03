import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax/iconsax.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/models/app_user.dart';
import '../../../core/models/student.dart';
import '../../../core/network/admin_api.dart';
import '../../../core/network/auth_api.dart';
import '../../shared/confirm_logout.dart';
import '../../shared/privacy_policy_screen.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neu.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/cards.dart';
import '../../../core/widgets/confirm_dialog.dart';
import '../../../core/widgets/motion.dart';
import 'admin_classes.dart';
import 'admin_messages.dart';
import 'admin_ptm.dart';
import 'admin_student_profile.dart';
import 'admin_subscription.dart';

// ── Students ───────────────────────────────────────────────

class AdminStudentsScreen extends StatefulWidget {
  const AdminStudentsScreen({super.key});

  @override
  State<AdminStudentsScreen> createState() => _AdminStudentsScreenState();
}

class _AdminStudentsScreenState extends State<AdminStudentsScreen> {
  final _searchCtl = TextEditingController();
  late Future<PaginatedStudents> _future;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load([String search = '']) {
    _future = AdminApi.instance.listStudents(search: search);
  }

  void _refresh([String search = '']) => setState(() => _load(search));

  @override
  void dispose() {
    _searchCtl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final accent = AppColors.adminPrimary;
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Students'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: _SearchBar(
              controller: _searchCtl,
              onChanged: (v) {
                _search = v;
                _refresh(v);
              },
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => _refresh(_search),
              child: FutureBuilder<PaginatedStudents>(
                future: _future,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snap.hasError) {
                    return _ErrorView(
                      error: snap.error,
                      onRetry: () => _refresh(_search),
                    );
                  }
                  final students = snap.data?.data ?? [];
                  if (students.isEmpty) {
                    return const _EmptyView();
                  }
                  return ListView.builder(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
                    itemCount: students.length,
                    itemBuilder: (_, i) {
                      final s = students[i];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: AppCard(
                          onTap: () => _openStudent(s),
                          child: Row(
                            children: [
                              AnimalAvatar(seed: s.fullName, gender: s.gender),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      s.fullName,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.textDark,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      s.admissionNumber,
                                      style: const TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              StatusChip(
                                label: _statusLabel(s.status),
                                type: s.status == 'active'
                                    ? ChipType.success
                                    : ChipType.neutral,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
      // Lifted clear of the floating bottom nav that the parent shell overlays
      // on this tab (the shell uses extendBody, so the nav sits over the body).
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 104),
        child: FloatingActionButton.extended(
          heroTag: 'addstu',
          backgroundColor: accent,
          icon: const Icon(Icons.add, color: Colors.white),
          label: const Text(
            'Add Student',
            style: TextStyle(color: Colors.white),
          ),
          onPressed: () => showAppBottomSheet(
            context: context,
            child: _AddStudentSheet(onCreated: () => _refresh()),
          ),
        ),
      ),
    );
  }

  Future<void> _openStudent(Student s) async {
    await Navigator.of(context).push(
      neuRoute(AdminStudentProfileScreen(student: s)),
    );
    // Name / status may have changed in the profile editor; refresh the list.
    if (mounted) _refresh(_search);
  }

  String _statusLabel(String status) =>
      status[0].toUpperCase() + status.substring(1);
}

// ── Add-student form ───────────────────────────────────────

class _AddStudentSheet extends StatefulWidget {
  const _AddStudentSheet({required this.onCreated});

  final VoidCallback onCreated;

  @override
  State<_AddStudentSheet> createState() => _AddStudentSheetState();
}

class _AddStudentSheetState extends State<_AddStudentSheet> {
  final _firstNameCtl = TextEditingController();
  final _lastNameCtl = TextEditingController();
  final _parentNameCtl = TextEditingController();
  final _parentPhoneCtl = TextEditingController();
  // TEMPORARY: the parent's email is their login identity while WhatsApp OTP
  // is disabled — required whenever a parent login is being created.
  final _parentEmailCtl = TextEditingController();
  String _gender = 'male';
  DateTime? _dob;
  bool _saving = false;
  String? _error;

  // Classes to choose from — only shown once some exist. Loaded on open.
  List<SchoolClass> _classes = const [];
  String? _selectedClassId;

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    try {
      final classes = await AdminApi.instance.listClasses();
      if (!mounted) return;
      setState(() => _classes = classes);
    } catch (_) {
      // A failed class fetch shouldn't block adding a student — the selector
      // is optional, so just leave it hidden and let the admin proceed.
    }
  }

  @override
  void dispose() {
    _firstNameCtl.dispose();
    _lastNameCtl.dispose();
    _parentNameCtl.dispose();
    _parentPhoneCtl.dispose();
    _parentEmailCtl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final firstName = _firstNameCtl.text.trim();
    final lastName = _lastNameCtl.text.trim();
    if (firstName.isEmpty || lastName.isEmpty) {
      setState(() => _error = 'Enter first and last name.');
      return;
    }
    if (_dob == null) {
      setState(() => _error = 'Select date of birth.');
      return;
    }
    final parentPhone = _parentPhoneCtl.text.trim();
    final parentEmail = _parentEmailCtl.text.trim();
    // A phone provisions a parent login, and that login now signs in by email —
    // so an email is required whenever a phone is given.
    if (parentPhone.isNotEmpty && parentEmail.isEmpty) {
      setState(() => _error =
          "Enter the parent's email — it's used to send their login code.");
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await AdminApi.instance.createStudent(
        firstName: firstName,
        lastName: lastName,
        dateOfBirth: _dob!,
        gender: _gender,
        parentPhone: parentPhone.isEmpty ? null : parentPhone,
        parentName: _parentNameCtl.text.trim().isEmpty
            ? null
            : _parentNameCtl.text.trim(),
        parentEmail: parentEmail.isEmpty ? null : parentEmail,
        classId: _selectedClassId,
      );
      if (!mounted) return;
      Navigator.pop(context);
      AppToast.show(
        context,
        _parentPhoneCtl.text.trim().isNotEmpty
            ? 'Student added · parent account created'
            : 'Student added',
        type: ToastType.success,
      );
      widget.onCreated();
    } on DioException catch (e) {
      final msg = switch (e.response?.statusCode) {
        409 => 'A student with this admission number already exists.',
        400 =>
          (e.response?.data as Map?)?['message']?.toString() ?? 'Invalid data.',
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Add student',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Entering the parent phone creates their login account automatically.',
              style: TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _firstNameCtl,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                      labelText: 'First name',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _lastNameCtl,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                      labelText: 'Last name',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Date of birth
            ListTile(
              contentPadding: EdgeInsets.zero,
              tileColor: Neu.bg,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppColors.mutedGray),
              ),
              leading: const Icon(Iconsax.calendar),
              title: Text(
                _dob != null
                    ? '${_dob!.day}/${_dob!.month}/${_dob!.year}'
                    : 'Date of birth',
                style: TextStyle(
                  color: _dob != null
                      ? AppColors.textDark
                      : AppColors.textMuted,
                ),
              ),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: DateTime.now().subtract(
                    const Duration(days: 365 * 3),
                  ),
                  firstDate: DateTime(2015),
                  lastDate: DateTime.now(),
                );
                if (picked != null) setState(() => _dob = picked);
              },
            ),
            const SizedBox(height: 12),
            // Gender
            Row(
              children: [
                const Text(
                  'Gender:',
                  style: TextStyle(color: AppColors.textMuted),
                ),
                const SizedBox(width: 12),
                ChoiceChip(
                  label: const Text('Male'),
                  selected: _gender == 'male',
                  onSelected: (_) => setState(() => _gender = 'male'),
                  selectedColor: AppColors.adminPrimary.withValues(alpha: 0.2),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('Female'),
                  selected: _gender == 'female',
                  onSelected: (_) => setState(() => _gender = 'female'),
                  selectedColor: AppColors.adminPrimary.withValues(alpha: 0.2),
                ),
              ],
            ),
            // Class — only offered once the school has classes to assign to.
            if (_classes.isNotEmpty) ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _selectedClassId,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Class (optional)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Iconsax.teacher),
                ),
                hint: const Text('Select a class'),
                items: [
                  const DropdownMenuItem<String>(
                    value: null,
                    child: Text('No class'),
                  ),
                  for (final c in _classes)
                    DropdownMenuItem<String>(
                      value: c.id,
                      child: Text(c.displayName),
                    ),
                ],
                onChanged: (v) => setState(() => _selectedClassId = v),
              ),
            ],
            const SizedBox(height: 12),
            const Divider(),
            const SizedBox(height: 8),
            const Text(
              'Parent / Guardian',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: AppColors.textDark,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _parentNameCtl,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Parent name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _parentPhoneCtl,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(
                labelText: 'Mobile number (creates parent login)',
                hintText: '98765 43210',
                prefixText: '+91 ',
                counterText: '',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Iconsax.mobile),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _parentEmailCtl,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              textCapitalization: TextCapitalization.none,
              decoration: const InputDecoration(
                labelText: 'Email (parent login code is sent here)',
                hintText: 'parent@example.com',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Iconsax.sms),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: const TextStyle(color: AppColors.danger, fontSize: 13),
              ),
            ],
            const SizedBox(height: 20),
            PrimaryButton(
              label: _saving ? 'Adding…' : 'Add to school',
              color: AppColors.adminPrimary,
              fullWidth: true,
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Admissions ─────────────────────────────────────────────

class AdminAdmissionsScreen extends StatefulWidget {
  const AdminAdmissionsScreen({super.key});

  @override
  State<AdminAdmissionsScreen> createState() => _AdminAdmissionsScreenState();
}

class _AdminAdmissionsScreenState extends State<AdminAdmissionsScreen> {
  late Future<List<InquiryModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = AdminApi.instance.listInquiries();
  }

  void _reload() => setState(() {
    _future = AdminApi.instance.listInquiries();
  });

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        backgroundColor: Neu.bg,
        appBar: AppBar(
          automaticallyImplyLeading: false,
          backgroundColor: Neu.bg,
          elevation: 0,
          title: const Text('Admissions'),
          bottom: const TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            indicatorColor: AppColors.adminPrimary,
            labelColor: AppColors.adminPrimary,
            unselectedLabelColor: AppColors.textMuted,
            tabs: [
              Tab(text: 'New'),
              Tab(text: 'Contacted'),
              Tab(text: 'Visited'),
              Tab(text: 'Converted'),
            ],
          ),
        ),
        floatingActionButton: FloatingActionButton.extended(
          heroTag: 'inquiry',
          backgroundColor: AppColors.adminPrimary,
          icon: const Icon(Icons.add, color: Colors.white),
          label: const Text(
            'New inquiry',
            style: TextStyle(color: Colors.white),
          ),
          onPressed: _openNewInquiry,
        ),
        body: FutureBuilder<List<InquiryModel>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return _ErrorView(error: snap.error, onRetry: _reload);
            }
            final all = snap.data ?? const <InquiryModel>[];
            return TabBarView(
              children: [
                _inquiryList(all.where((i) => i.status == 'new').toList()),
                _inquiryList(
                  all.where((i) => i.status == 'contacted').toList(),
                ),
                _inquiryList(all.where((i) => i.status == 'visited').toList()),
                _inquiryList(
                  all.where((i) => i.status == 'converted').toList(),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _inquiryList(List<InquiryModel> items) {
    if (items.isEmpty) {
      return const _EmptyView(message: 'No inquiries in this stage.');
    }
    return RefreshIndicator(
      onRefresh: () async => _reload(),
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 90),
        itemCount: items.length,
        itemBuilder: (_, i) {
          final inq = items[i];
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: AppCard(
              onTap: () => _openInquiry(inq),
              child: Row(
                children: [
                  AnimalAvatar(seed: inq.childName),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          inq.childName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: AppColors.textDark,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Parent: ${inq.parentName}${inq.createdAt != null ? ' · ${Formatters.formatShortDate(inq.createdAt!)}' : ''}',
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  StatusChip(
                    label: _statusLabel(inq.status),
                    type: _statusChip(inq.status),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  static String _statusLabel(String s) => switch (s) {
    'contacted' => 'Contacted',
    'visited' => 'Visited',
    'converted' => 'Converted',
    'closed' => 'Closed',
    _ => 'New',
  };

  static ChipType _statusChip(String s) => switch (s) {
    'converted' => ChipType.success,
    'closed' => ChipType.neutral,
    'visited' => ChipType.warning,
    _ => ChipType.info,
  };

  void _openInquiry(InquiryModel inq) {
    // Next stage in the admissions funnel for the primary action button.
    final next = switch (inq.status) {
      'new' => ('contacted', 'Mark contacted'),
      'contacted' => ('visited', 'Mark visited'),
      'visited' => ('converted', 'Mark converted'),
      _ => (null, null),
    };
    showAppBottomSheet<void>(
      context: context,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              inq.childName,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Parent ${inq.parentName} · ${inq.parentPhone}${inq.gradeInterested != null ? '\nInterested in: ${inq.gradeInterested}' : ''}',
              style: const TextStyle(color: AppColors.textMuted, height: 1.4),
            ),
            if (inq.notes != null) ...[
              const SizedBox(height: 8),
              Text(inq.notes!, style: const TextStyle(height: 1.4)),
            ],
            const SizedBox(height: 16),
            Builder(
              builder: (ctx) {
                return Row(
                  children: [
                    if (next.$1 != null)
                      Expanded(
                        child: PrimaryButton(
                          label: next.$2!,
                          color: AppColors.success,
                          onPressed: () => _setStatus(ctx, inq, next.$1!),
                        ),
                      ),
                    if (next.$1 != null && inq.status != 'converted')
                      const SizedBox(width: 8),
                    if (inq.status != 'converted' && inq.status != 'closed')
                      Expanded(
                        child: SecondaryButton(
                          label: 'Close',
                          color: AppColors.danger,
                          onPressed: () => _setStatus(ctx, inq, 'closed'),
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _setStatus(
    BuildContext sheetCtx,
    InquiryModel inq,
    String status,
  ) async {
    try {
      await AdminApi.instance.updateInquiryStatus(inq.id, status);
      if (!sheetCtx.mounted) return;
      Navigator.pop(sheetCtx);
      if (!mounted) return;
      AppToast.show(
        context,
        '${inq.childName} → ${_statusLabel(status)}',
        type: ToastType.success,
      );
      _reload();
    } catch (e) {
      if (!sheetCtx.mounted) return;
      AppToast.show(sheetCtx, 'Failed: $e', type: ToastType.error);
    }
  }

  void _openNewInquiry() {
    final child = TextEditingController();
    final parent = TextEditingController();
    final phone = TextEditingController();
    final grade = TextEditingController();
    showAppBottomSheet<void>(
      context: context,
      scrollable: true,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'New inquiry',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: child,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Child name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: parent,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Parent name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: phone,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(
                labelText: 'Parent mobile',
                prefixText: '+91 ',
                counterText: '',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: grade,
              decoration: const InputDecoration(
                labelText: 'Grade interested (optional)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            Builder(
              builder: (ctx) {
                return PrimaryButton(
                  label: 'Save inquiry',
                  color: AppColors.adminPrimary,
                  fullWidth: true,
                  onPressed: () async {
                    if (child.text.trim().isEmpty ||
                        parent.text.trim().isEmpty ||
                        phone.text.trim().isEmpty) {
                      AppToast.show(
                        ctx,
                        'Child, parent and phone are required',
                        type: ToastType.error,
                      );
                      return;
                    }
                    try {
                      await AdminApi.instance.createInquiry(
                        childName: child.text.trim(),
                        parentName: parent.text.trim(),
                        parentPhone: phone.text.trim(),
                        gradeInterested: grade.text.trim().isEmpty
                            ? null
                            : grade.text.trim(),
                      );
                      if (!ctx.mounted) return;
                      Navigator.pop(ctx);
                      if (!mounted) return;
                      AppToast.show(
                        context,
                        'Inquiry saved',
                        type: ToastType.success,
                      );
                      _reload();
                    } catch (e) {
                      if (!ctx.mounted) return;
                      AppToast.show(ctx, 'Failed: $e', type: ToastType.error);
                    }
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

// ── Staff (real users from backend) ───────────────────────

class AdminStaffScreen extends StatefulWidget {
  const AdminStaffScreen({super.key});

  @override
  State<AdminStaffScreen> createState() => _AdminStaffScreenState();
}

class _AdminStaffScreenState extends State<AdminStaffScreen> {
  late Future<List<AppUser>> _future;

  @override
  void initState() {
    super.initState();
    _future = AdminApi.instance.listStaff();
  }

  void _refresh() => setState(() {
    _future = AdminApi.instance.listStaff();
  });

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: Neu.bg,
        appBar: AppBar(
          automaticallyImplyLeading: false,
          backgroundColor: Neu.bg,
          elevation: 0,
          title: const Text('Staff'),
          bottom: const TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            indicatorColor: AppColors.adminPrimary,
            labelColor: AppColors.adminPrimary,
            unselectedLabelColor: AppColors.textMuted,
            tabs: [
              Tab(text: 'All Accounts'),
              Tab(text: 'Teachers'),
              Tab(text: 'Leave Requests'),
            ],
          ),
        ),
        body: FutureBuilder<List<AppUser>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return _ErrorView(error: snap.error, onRetry: _refresh);
            }
            final users = snap.data ?? [];
            final teachers = users.where((u) => u.role == 'Teacher').toList();
            return TabBarView(
              children: [
                _userList(users),
                teachers.isEmpty
                    ? const _EmptyView(message: 'No teacher accounts yet.')
                    : _userList(teachers),
                _leaveList(context),
              ],
            );
          },
        ),
        floatingActionButton: FloatingActionButton.extended(
          heroTag: 'addteacher',
          backgroundColor: AppColors.adminPrimary,
          icon: const Icon(Icons.add, color: Colors.white),
          label: const Text(
            'Add Teacher',
            style: TextStyle(color: Colors.white),
          ),
          onPressed: () => showAppBottomSheet(
            context: context,
            scrollable: true,
            child: _AddTeacherSheet(onCreated: _refresh),
          ),
        ),
      ),
    );
  }

  Widget _userList(List<AppUser> users) {
    if (users.isEmpty) return const _EmptyView(message: 'No accounts yet.');
    return RefreshIndicator(
      onRefresh: () async => _refresh(),
      child: ListView.builder(
        padding: const EdgeInsets.all(20),
        itemCount: users.length,
        itemBuilder: (context, i) {
          final u = users[i];
          final isTeacher = u.role == 'Teacher';
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: AppCard(
              // Teachers open their weekly/monthly attendance report.
              onTap: isTeacher
                  ? () => Navigator.of(context).push(
                      neuRoute(TeacherAttendanceReportScreen(teacher: u),
                      ),
                    )
                  : null,
              child: Row(
                children: [
                  InitialAvatar(name: u.name, color: AppColors.adminPrimary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          u.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: AppColors.textDark,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          isTeacher ? '${u.role} · Tap for attendance' : u.role,
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  StatusChip(
                    label: u.active ? 'Active' : 'Inactive',
                    type: u.active ? ChipType.success : ChipType.neutral,
                  ),
                  if (isTeacher) ...[
                    const SizedBox(width: 2),
                    PopupMenuButton<String>(
                      icon: const Icon(Iconsax.more, size: 18,
                          color: AppColors.textMuted),
                      color: Colors.white,
                      elevation: 6,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                      ),
                      onSelected: (v) {
                        switch (v) {
                          case 'attendance':
                            Navigator.of(context).push(
                              neuRoute(
                                  TeacherAttendanceReportScreen(teacher: u)),
                            );
                          case 'edit':
                            showAppBottomSheet(
                              context: context,
                              scrollable: true,
                              child: _EditTeacherSheet(
                                  teacher: u, onSaved: _refresh),
                            );
                          case 'delete':
                            _confirmDeleteTeacher(u);
                        }
                      },
                      itemBuilder: (_) => const [
                        PopupMenuItem(
                          value: 'attendance',
                          child: Row(
                            children: [
                              Icon(Iconsax.calendar_tick, size: 18),
                              SizedBox(width: 10),
                              Text('View attendance'),
                            ],
                          ),
                        ),
                        PopupMenuItem(
                          value: 'edit',
                          child: Row(
                            children: [
                              Icon(Iconsax.edit, size: 18),
                              SizedBox(width: 10),
                              Text('Edit'),
                            ],
                          ),
                        ),
                        PopupMenuItem(
                          value: 'delete',
                          child: Row(
                            children: [
                              Icon(Iconsax.trash,
                                  size: 18, color: AppColors.danger),
                              SizedBox(width: 10),
                              Text('Delete',
                                  style: TextStyle(color: AppColors.danger)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _confirmDeleteTeacher(AppUser teacher) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete teacher?'),
        content: Text(
          'This permanently removes ${teacher.name}\'s account. '
          'They will no longer be able to sign in. This cannot be undone.',
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
      await AdminApi.instance.deleteStaff(teacher.id);
      if (!mounted) return;
      AppToast.show(context, 'Teacher deleted', type: ToastType.success);
      _refresh();
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = switch (e.response?.statusCode) {
        404 => 'Account not found — it may already be deleted.',
        403 => "You don't have permission to delete this account.",
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

  Widget _leaveList(BuildContext context) => const _StaffLeaveTab();
}

/// Staff leave requests — real data from the leave module.
class _StaffLeaveTab extends StatefulWidget {
  const _StaffLeaveTab();

  @override
  State<_StaffLeaveTab> createState() => _StaffLeaveTabState();
}

class _StaffLeaveTabState extends State<_StaffLeaveTab> {
  late Future<List<LeaveModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = AdminApi.instance.listLeaves();
  }

  void _reload() => setState(() {
    _future = AdminApi.instance.listLeaves();
  });

  Future<void> _decide(LeaveModel l, String status) async {
    try {
      await AdminApi.instance.decideLeave(l.id, status);
      if (!mounted) return;
      AppToast.show(
        context,
        status == 'approved' ? 'Approved' : 'Rejected',
        type: status == 'approved' ? ToastType.success : ToastType.info,
      );
      _reload();
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Failed: $e', type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<LeaveModel>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final staffLeaves = (snap.data ?? const <LeaveModel>[])
            .where((l) => l.applicantRole != 'parent')
            .toList();
        if (staffLeaves.isEmpty) {
          return const _EmptyView(message: 'No staff leave requests.');
        }
        return RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView.builder(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            padding: const EdgeInsets.all(20),
            itemCount: staffLeaves.length,
            itemBuilder: (_, i) {
              final l = staffLeaves[i];
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Applicant (teacher) details.
                      Row(
                        children: [
                          InitialAvatar(
                            name: l.applicantName ?? 'Staff',
                            color: AppColors.adminPrimary,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  l.applicantName ?? 'Staff member',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textDark,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  [
                                    _roleLabel(l.applicantRole),
                                    if (l.applicantEmail != null)
                                      l.applicantEmail!,
                                  ].join(' · '),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (l.status != 'pending')
                            StatusChip(
                              label: switch (l.status) {
                                'approved' => 'Approved',
                                'rejected' => 'Rejected',
                                'cancelled' => 'Cancelled',
                                _ => 'Pending',
                              },
                              type: switch (l.status) {
                                'approved' => ChipType.success,
                                'rejected' || 'cancelled' => ChipType.danger,
                                _ => ChipType.warning,
                              },
                            ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        '${l.type[0].toUpperCase()}${l.type.substring(1)} leave',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          color: AppColors.textDark,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${l.fromDate == null ? '' : Formatters.formatShortDate(l.fromDate!)} – ${l.toDate == null ? '' : Formatters.formatShortDate(l.toDate!)}${l.reason == null ? '' : ' · ${l.reason}'}',
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 12,
                        ),
                      ),
                      if (l.status == 'pending') ...[
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TintedIconButton(
                              icon: Icons.close_rounded,
                              color: AppColors.danger,
                              onTap: () => _decide(l, 'rejected'),
                            ),
                            const SizedBox(width: 8),
                            TintedIconButton(
                              icon: Icons.check_rounded,
                              color: AppColors.success,
                              onTap: () => _decide(l, 'approved'),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

// ── Add-teacher form ───────────────────────────────────────

class _AddTeacherSheet extends StatefulWidget {
  const _AddTeacherSheet({required this.onCreated});
  final VoidCallback onCreated;

  @override
  State<_AddTeacherSheet> createState() => _AddTeacherSheetState();
}

class _AddTeacherSheetState extends State<_AddTeacherSheet> {
  final _nameCtl = TextEditingController();
  final _emailCtl = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _nameCtl.dispose();
    _emailCtl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameCtl.text.trim();
    final email = _emailCtl.text.trim();
    if (name.isEmpty || email.isEmpty) {
      setState(() => _error = 'Name and email are required.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await AdminApi.instance.addTeacher(name: name, email: email);
      if (!mounted) return;
      Navigator.pop(context);
      AppToast.show(
        context,
        'Teacher account created. Invite sent.',
        type: ToastType.success,
      );
      widget.onCreated();
    } on DioException catch (e) {
      final msg = switch (e.response?.statusCode) {
        409 => 'An account with this email already exists.',
        400 =>
          (e.response?.data as Map?)?['message']?.toString() ?? 'Invalid data.',
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Add teacher',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'An invitation email will be sent so the teacher can set their password.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _nameCtl,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              labelText: 'Full name',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _emailCtl,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: 'Email address',
              border: OutlineInputBorder(),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(
              _error!,
              style: const TextStyle(color: AppColors.danger, fontSize: 13),
            ),
          ],
          const SizedBox(height: 20),
          PrimaryButton(
            label: _saving ? 'Creating…' : 'Create account',
            color: AppColors.adminPrimary,
            fullWidth: true,
            onPressed: _saving ? null : _save,
          ),
        ],
      ),
    );
  }
}

// ── Edit-teacher form ──────────────────────────────────────

class _EditTeacherSheet extends StatefulWidget {
  const _EditTeacherSheet({required this.teacher, required this.onSaved});
  final AppUser teacher;
  final VoidCallback onSaved;

  @override
  State<_EditTeacherSheet> createState() => _EditTeacherSheetState();
}

class _EditTeacherSheetState extends State<_EditTeacherSheet> {
  late final _nameCtl = TextEditingController(text: widget.teacher.name);
  late final _emailCtl = TextEditingController(text: widget.teacher.email);
  late final _phoneCtl = TextEditingController(text: widget.teacher.phone ?? '');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _nameCtl.dispose();
    _emailCtl.dispose();
    _phoneCtl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameCtl.text.trim();
    final email = _emailCtl.text.trim();
    final phone = _phoneCtl.text.trim();
    if (name.isEmpty || email.isEmpty) {
      setState(() => _error = 'Name and email are required.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await AdminApi.instance.updateStaff(
        widget.teacher.id,
        name: name,
        email: email,
        // Send '' to clear the phone; only omit when it was never set.
        phone: phone.isEmpty && widget.teacher.phone == null ? null : phone,
      );
      if (!mounted) return;
      Navigator.pop(context);
      AppToast.show(context, 'Teacher updated', type: ToastType.success);
      widget.onSaved();
    } on DioException catch (e) {
      final msg = switch (e.response?.statusCode) {
        409 => 'An account with this email already exists.',
        400 =>
          (e.response?.data as Map?)?['message']?.toString() ?? 'Invalid data.',
        404 => 'Account not found — it may have been deleted.',
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Edit teacher',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _nameCtl,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              labelText: 'Full name',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _emailCtl,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: 'Email address',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _phoneCtl,
            keyboardType: TextInputType.phone,
            maxLength: 10,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(
              labelText: 'Mobile number (optional)',
              prefixText: '+91 ',
              counterText: '',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Iconsax.mobile),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(
              _error!,
              style: const TextStyle(color: AppColors.danger, fontSize: 13),
            ),
          ],
          const SizedBox(height: 20),
          PrimaryButton(
            label: _saving ? 'Saving…' : 'Save changes',
            color: AppColors.adminPrimary,
            fullWidth: true,
            onPressed: _saving ? null : _save,
          ),
        ],
      ),
    );
  }
}

// ── Teacher attendance report (weekly / monthly) ──────────

enum _ReportRange { week, month }

class TeacherAttendanceReportScreen extends StatefulWidget {
  const TeacherAttendanceReportScreen({super.key, required this.teacher});

  final AppUser teacher;

  @override
  State<TeacherAttendanceReportScreen> createState() =>
      _TeacherAttendanceReportScreenState();
}

class _TeacherAttendanceReportScreenState
    extends State<TeacherAttendanceReportScreen> {
  _ReportRange _range = _ReportRange.week;
  late Future<StaffAttendanceReport> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  ({String from, String to}) _rangeDates() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    String fmt(DateTime d) => d.toIso8601String().split('T').first;
    if (_range == _ReportRange.week) {
      // Monday of the current week → today.
      final monday = today.subtract(Duration(days: today.weekday - 1));
      return (from: fmt(monday), to: fmt(today));
    }
    // First of the month → today.
    return (from: fmt(DateTime(now.year, now.month, 1)), to: fmt(today));
  }

  Future<StaffAttendanceReport> _load() {
    final r = _rangeDates();
    return AdminApi.instance.getStaffAttendanceReport(
      staffId: widget.teacher.id,
      from: r.from,
      to: r.to,
    );
  }

  void _select(_ReportRange range) {
    if (range == _range) return;
    setState(() {
      _range = range;
      _future = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: Text('${widget.teacher.name} · Attendance'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
            child: Row(
              children: [
                Expanded(
                  child: _RangeTab(
                    label: 'This week',
                    selected: _range == _ReportRange.week,
                    onTap: () => _select(_ReportRange.week),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _RangeTab(
                    label: 'This month',
                    selected: _range == _ReportRange.month,
                    onTap: () => _select(_ReportRange.month),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: FutureBuilder<StaffAttendanceReport>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snap.hasError) {
                  return _ErrorView(
                    error: snap.error,
                    onRetry: () => setState(() {
                      _future = _load();
                    }),
                  );
                }
                final rep = snap.data!;
                return ListView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
                  children: [
                    _ReportSummary(report: rep),
                    const SizedBox(height: 16),
                    const Text(
                      'Day by day',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        color: AppColors.textDark,
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (rep.days.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Text(
                          'No attendance recorded in this period yet.',
                          style: TextStyle(color: AppColors.textMuted),
                        ),
                      )
                    else
                      for (final d in rep.days.reversed)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: AppCard(
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    _prettyDate(d.date),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.textDark,
                                    ),
                                  ),
                                ),
                                StatusChip(
                                  label: _statusLabel(d.status),
                                  type: _statusChip(d.status),
                                ),
                              ],
                            ),
                          ),
                        ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  String _prettyDate(String iso) {
    final d = DateTime.tryParse(iso);
    return d == null ? iso : Formatters.formatShortDate(d);
  }

  static String _statusLabel(String s) => switch (s) {
    'present' => 'Present',
    'absent' => 'Absent',
    'late' => 'Late',
    'half_day' => 'Half day',
    'on_leave' => 'On leave',
    'holiday' => 'Holiday',
    _ => s,
  };

  static ChipType _statusChip(String s) => switch (s) {
    'present' => ChipType.success,
    'late' || 'half_day' => ChipType.warning,
    'absent' => ChipType.danger,
    'on_leave' => ChipType.info,
    _ => ChipType.neutral,
  };
}

class _RangeTab extends StatelessWidget {
  const _RangeTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.adminPrimary : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? AppColors.adminPrimary : AppColors.mutedGray,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : AppColors.textMuted,
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}

class _ReportSummary extends StatelessWidget {
  const _ReportSummary({required this.report});
  final StaffAttendanceReport report;

  @override
  Widget build(BuildContext context) {
    final attended = report.present + report.late + report.halfDay;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppCard(
          child: Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${report.presentRate}%',
                    style: const TextStyle(
                      fontSize: 34,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textDark,
                    ),
                  ),
                  const Text(
                    'Attendance rate',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                  ),
                ],
              ),
              const Spacer(),
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  Iconsax.user_tick,
                  color: AppColors.success,
                  size: 26,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: StatCard(
                label: 'Present',
                value: '$attended',
                icon: Iconsax.tick_circle,
                accent: AppColors.success,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: StatCard(
                label: 'Absent',
                value: '${report.absent}',
                icon: Iconsax.close_circle,
                accent: AppColors.danger,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          '${report.marked} of ${report.workingDays} working days marked (Mon–Sat)'
          '${report.late > 0 ? ' · ${report.late} late' : ''}',
          style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
        ),
      ],
    );
  }
}

// ── More ───────────────────────────────────────────────────

class AdminMoreScreen extends StatelessWidget {
  const AdminMoreScreen({super.key});

  static const _items = [
    ('Staff Management', '👩‍🏫', AppColors.brandNavy, AppColors.adminTint),
    ('Classes', '🏫', AppColors.brandBlue, Color(0xFFE7EFFD)),
    ('Admissions', '📋', AppColors.brandNavy, AppColors.adminTint),
    ('Communication', '💬', AppColors.brandPink, Color(0xFFFCE7EC)),
    ('PTM', '🤝', AppColors.brandPurple, Color(0xFFF3E9FD)),
    ('Reports', '📊', AppColors.success, Color(0xFFE8FFE3)),
    ('Events', '🎉', AppColors.brandIndigo, Color(0xFFECEDFB)),
    ('Gallery', '📸', AppColors.brandPurple, Color(0xFFF3E9FD)),
    ('Transport', '🚌', AppColors.brandTeal, Color(0xFFE1F6FA)),
    ('Holidays', '🎌', AppColors.gold, Color(0xFFFEF7D6)),
    ('Leave Management', '🌴', AppColors.brandTeal, Color(0xFFE1F6FA)),
    // What the school pays Sproutly — not the fees its parents pay it.
    ('Subscription', '💳', AppColors.brandIndigo, AppColors.parentTint),
    ('Settings', '⚙️', AppColors.textMuted, AppColors.mutedGray),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('More'),
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(20),
        physics: const BouncingScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.05,
        ),
        itemCount: _items.length,
        itemBuilder: (_, i) {
          final t = _items[i];
          return PressableScale(
                child: Material(
                  color: t.$4,
                  borderRadius: BorderRadius.circular(20),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => _open(context, t.$1),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(t.$2, style: const TextStyle(fontSize: 36)),
                          const SizedBox(height: 8),
                          Text(
                            t.$1,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: t.$3,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              )
              .animate(delay: (30 * i).ms)
              .fadeIn(duration: 280.ms, curve: Curves.easeOut)
              .slideY(begin: 0.05, curve: Curves.easeOutCubic);
        },
      ),
    );
  }

  void _open(BuildContext context, String label) {
    Widget? screen;
    switch (label) {
      case 'Staff Management':
        screen = const AdminStaffScreen();
      case 'Classes':
        screen = const AdminClassesScreen();
      case 'Admissions':
        screen = const AdminAdmissionsScreen();
      case 'Communication':
        screen = const AdminCommunicationScreen();
      case 'PTM':
        screen = const AdminPtmScreen();
      case 'Reports':
        screen = const AdminReportsScreen();
      case 'Events':
        screen = const AdminEventsScreen();
      case 'Gallery':
        screen = const AdminGalleryScreen();
      case 'Transport':
        screen = const AdminTransportScreen();
      case 'Holidays':
        screen = const AdminHolidaysScreen();
      case 'Leave Management':
        screen = const AdminLeaveMgmtScreen();
      case 'Subscription':
        screen = const AdminSubscriptionScreen();
      case 'Settings':
        screen = const AdminSettingsScreen();
    }
    if (screen != null) {
      Navigator.push(context, neuRoute(screen));
    }
  }
}

// ── Communication ──────────────────────────────────────────

class AdminCommunicationScreen extends StatefulWidget {
  const AdminCommunicationScreen({super.key});

  @override
  State<AdminCommunicationScreen> createState() =>
      _AdminCommunicationScreenState();
}

class _AdminCommunicationScreenState extends State<AdminCommunicationScreen> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  bool _emergency = false;
  bool _sending = false;
  late Future<List<CircularModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = AdminApi.instance.getCirculars();
  }

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_title.text.trim().isEmpty || _body.text.trim().isEmpty) {
      AppToast.show(
        context,
        'Title and message are required',
        type: ToastType.error,
      );
      return;
    }
    setState(() => _sending = true);
    try {
      if (_emergency) {
        await AdminApi.instance.createAlert(
          title: _title.text.trim(),
          body: _body.text.trim(),
        );
      } else {
        await AdminApi.instance.createCircular(
          title: _title.text.trim(),
          body: _body.text.trim(),
        );
      }
      if (!mounted) return;
      _title.clear();
      _body.clear();
      setState(() {
        _sending = false;
        _future = AdminApi.instance.getCirculars();
      });
      AppToast.show(
        context,
        _emergency ? 'Emergency alert broadcast' : 'Circular sent',
        type: ToastType.success,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _sending = false);
      AppToast.show(context, 'Failed: $e', type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Two halves of communication: talking *at* the school (circulars and
    // emergency alerts) and talking *with* it (1:1 chats where the admin
    // resolves teacher and parent queries).
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: Neu.bg,
        appBar: AppBar(
          backgroundColor: Neu.bg,
          elevation: 0,
          title: const Text('Communication'),
          bottom: const TabBar(
            labelColor: AppColors.adminPrimary,
            unselectedLabelColor: AppColors.textMuted,
            indicatorColor: AppColors.adminPrimary,
            tabs: [Tab(text: 'Broadcast'), Tab(text: 'Messages')],
          ),
        ),
        body: TabBarView(
          children: [_broadcastTab(), const AdminMessagesTab()],
        ),
      ),
    );
  }

  Widget _broadcastTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _emergency ? 'Emergency broadcast' : 'Send circular',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _title,
                  decoration: const InputDecoration(
                    labelText: 'Title',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _body,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    hintText: 'Type your message…',
                    border: OutlineInputBorder(),
                  ),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text(
                    'Emergency alert',
                    style: TextStyle(fontSize: 14),
                  ),
                  subtitle: const Text(
                    'Broadcast urgently instead of a normal circular',
                    style: TextStyle(fontSize: 12),
                  ),
                  value: _emergency,
                  activeThumbColor: AppColors.danger,
                  onChanged: (v) => setState(() => _emergency = v),
                ),
                PrimaryButton(
                  label: _sending
                      ? 'Sending…'
                      : _emergency
                      ? 'Broadcast alert'
                      : 'Send to everyone',
                  color: _emergency ? AppColors.danger : AppColors.adminPrimary,
                  fullWidth: true,
                  onPressed: _sending ? null : _send,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          FutureBuilder<List<CircularModel>>(
            future: _future,
            builder: (context, snap) {
              final items = snap.data ?? const <CircularModel>[];
              if (items.isEmpty) return const SizedBox.shrink();
              return AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Recent circulars',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    for (final c in items.take(10))
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    c.title,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                    ),
                                  ),
                                  Text(
                                    c.body,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (c.publishedAt != null)
                              Text(
                                Formatters.formatShortDate(c.publishedAt!),
                                style: const TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 11,
                                ),
                              ),
                          ],
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}

// ── Events ─────────────────────────────────────────────────

class AdminEventsScreen extends StatefulWidget {
  const AdminEventsScreen({super.key});

  @override
  State<AdminEventsScreen> createState() => _AdminEventsScreenState();
}

class _AdminEventsScreenState extends State<AdminEventsScreen> {
  late Future<List<EventModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = AdminApi.instance.getEvents();
  }

  void _reload() => setState(() {
    _future = AdminApi.instance.getEvents();
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Events'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'event',
        backgroundColor: AppColors.adminPrimary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New event', style: TextStyle(color: Colors.white)),
        onPressed: _openNewEvent,
      ),
      body: FutureBuilder<List<EventModel>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return _ErrorView(error: snap.error, onRetry: _reload);
          }
          final events = snap.data ?? const <EventModel>[];
          if (events.isEmpty) {
            return const _EmptyView(
              message: 'No events yet. Create the first one!',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 90),
              children: [
                for (final e in events)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: AppCard(
                      child: Row(
                        children: [
                          const Text('🎉', style: TextStyle(fontSize: 24)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  e.title,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  [
                                    if (e.startDate != null)
                                      Formatters.formatDate(e.startDate!),
                                    if (e.venue != null) e.venue!,
                                  ].join(' · '),
                                  style: const TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(
                              Iconsax.trash,
                              size: 18,
                              color: AppColors.danger,
                            ),
                            onPressed: () async {
                              try {
                                await AdminApi.instance.deleteEvent(e.id);
                                if (!context.mounted) return;
                                AppToast.show(
                                  context,
                                  'Event removed',
                                  type: ToastType.success,
                                );
                                _reload();
                              } catch (err) {
                                if (!context.mounted) return;
                                AppToast.show(
                                  context,
                                  'Failed: $err',
                                  type: ToastType.error,
                                );
                              }
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _openNewEvent() {
    final title = TextEditingController();
    final desc = TextEditingController();
    final venue = TextEditingController();
    DateTime date = DateTime.now().add(const Duration(days: 7));
    showAppBottomSheet<void>(
      context: context,
      scrollable: true,
      child: StatefulBuilder(
        builder: (ctx, setSt) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'New event',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: title,
                  decoration: const InputDecoration(
                    labelText: 'Title',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                ListTile(
                  tileColor: Neu.bg,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: AppColors.mutedGray),
                  ),
                  title: const Text('Date'),
                  subtitle: Text('${date.day}/${date.month}/${date.year}'),
                  trailing: const Icon(Icons.calendar_today_rounded, size: 18),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: date,
                      firstDate: DateTime.now(),
                      lastDate: DateTime(2027, 12, 31),
                    );
                    if (picked != null) setSt(() => date = picked);
                  },
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: venue,
                  decoration: const InputDecoration(
                    labelText: 'Venue (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: desc,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Description (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                PrimaryButton(
                  label: 'Create event',
                  color: AppColors.adminPrimary,
                  fullWidth: true,
                  onPressed: () async {
                    if (title.text.trim().isEmpty) {
                      AppToast.show(
                        ctx,
                        'Title is required',
                        type: ToastType.error,
                      );
                      return;
                    }
                    try {
                      await AdminApi.instance.createEvent(
                        title: title.text.trim(),
                        startDate:
                            '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
                        description: desc.text.trim().isEmpty
                            ? null
                            : desc.text.trim(),
                        venue: venue.text.trim().isEmpty
                            ? null
                            : venue.text.trim(),
                      );
                      if (!ctx.mounted) return;
                      Navigator.pop(ctx);
                      if (!mounted) return;
                      AppToast.show(
                        context,
                        'Event created',
                        type: ToastType.success,
                      );
                      _reload();
                    } catch (e) {
                      if (!ctx.mounted) return;
                      AppToast.show(ctx, 'Failed: $e', type: ToastType.error);
                    }
                  },
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Transport ──────────────────────────────────────────────

class AdminTransportScreen extends StatefulWidget {
  const AdminTransportScreen({super.key});

  @override
  State<AdminTransportScreen> createState() => _AdminTransportScreenState();
}

class _AdminTransportScreenState extends State<AdminTransportScreen> {
  late Future<List<TransportInfo>> _future = AdminApi.instance.listTransport();

  void _reload() => setState(() {
    _future = AdminApi.instance.listTransport();
  });

  Future<void> _create() async {
    final saved = await _showTransportForm(context);
    if (saved != null && mounted) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Transport'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.adminPrimary,
        foregroundColor: Colors.white,
        onPressed: _create,
        icon: const Icon(Iconsax.bus),
        label: const Text('Add'),
      ),
      body: FutureBuilder<List<TransportInfo>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return EmptyState(
              emoji: '🚌',
              title: 'Could not load transport',
              subtitle: '${snap.error}',
              ctaLabel: 'Retry',
              onCta: _reload,
            );
          }
          final items = snap.data ?? const <TransportInfo>[];
          if (items.isEmpty) {
            return const EmptyState(
              emoji: '🚌',
              title: 'No transport yet',
              subtitle: 'Tap Add to create the first route.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              padding: const EdgeInsets.all(20),
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final t = items[i];
                return AppCard(
                  onTap: () => Navigator.of(context)
                      .push(neuRoute<void>(_TransportDetailScreen(info: t)))
                      .then((_) => _reload()),
                  child: Row(
                    children: [
                      const Text('🚌', style: TextStyle(fontSize: 24)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              t.title ?? 'Vehicle',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${t.assignedStudents.length} students · ${t.assignedStaff.length} teachers',
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: AppColors.textMuted,
                      ),
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

/// Create or edit a transport vehicle/route. Returns the saved TransportInfo,
/// or null if cancelled. Captures the full field set the parent view shows
/// (route, vehicle number, driver name/phone) — not just title + notes.
Future<TransportInfo?> _showTransportForm(
  BuildContext context, {
  TransportInfo? existing,
}) {
  final title = TextEditingController(text: existing?.title ?? '');
  final routeName = TextEditingController(text: existing?.routeName ?? '');
  final vehicleNumber =
      TextEditingController(text: existing?.vehicleNumber ?? '');
  final driverName = TextEditingController(text: existing?.driverName ?? '');
  final driverPhone = TextEditingController(text: existing?.driverPhone ?? '');
  final notes = TextEditingController(text: existing?.notes ?? '');
  final isEdit = existing != null;
  bool saving = false;

  InputDecoration dec(String label) => InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        isDense: true,
      );

  return showAppBottomSheet<TransportInfo>(
    context: context,
    child: StatefulBuilder(builder: (ctx, setSt) {
      Future<void> submit() async {
        if (title.text.trim().isEmpty) {
          AppToast.show(ctx, 'Enter a name', type: ToastType.error);
          return;
        }
        setSt(() => saving = true);
        try {
          final saved = existing != null
              ? await AdminApi.instance.updateTransport(
                  existing.id,
                  title: title.text.trim(),
                  routeName: routeName.text.trim(),
                  vehicleNumber: vehicleNumber.text.trim(),
                  driverName: driverName.text.trim(),
                  driverPhone: driverPhone.text.trim(),
                  notes: notes.text.trim(),
                )
              : await AdminApi.instance.createTransport(
                  title: title.text.trim(),
                  routeName: routeName.text.trim(),
                  vehicleNumber: vehicleNumber.text.trim(),
                  driverName: driverName.text.trim(),
                  driverPhone: driverPhone.text.trim(),
                  notes: notes.text.trim(),
                );
          if (ctx.mounted) Navigator.of(ctx).pop(saved);
        } catch (e) {
          setSt(() => saving = false);
          if (ctx.mounted) {
            AppToast.show(ctx, 'Failed: $e', type: ToastType.error);
          }
        }
      }

      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(isEdit ? 'Edit transport' : 'Add transport',
                  style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textDark)),
              const SizedBox(height: 12),
              TextField(
                  controller: title,
                  autofocus: !isEdit,
                  decoration: dec('Name (e.g. Route 1 — Bus KA-01)')),
              const SizedBox(height: 8),
              TextField(controller: routeName, decoration: dec('Route name')),
              const SizedBox(height: 8),
              TextField(
                  controller: vehicleNumber,
                  decoration: dec('Vehicle number')),
              const SizedBox(height: 8),
              TextField(controller: driverName, decoration: dec('Driver name')),
              const SizedBox(height: 8),
              TextField(
                  controller: driverPhone,
                  keyboardType: TextInputType.phone,
                  decoration: dec('Driver phone')),
              const SizedBox(height: 8),
              TextField(
                  controller: notes,
                  maxLines: 2,
                  decoration: dec('Notes (stops, timings…)')),
              const SizedBox(height: 16),
              PrimaryButton(
                label: saving
                    ? 'Saving…'
                    : (isEdit ? 'Save changes' : 'Create'),
                color: AppColors.adminPrimary,
                fullWidth: true,
                onPressed: saving ? null : submit,
              ),
            ],
          ),
        ),
      );
    }),
  );
}

/// Assign / unassign students and teachers for one vehicle.
class _TransportDetailScreen extends StatefulWidget {
  const _TransportDetailScreen({required this.info});
  final TransportInfo info;

  @override
  State<_TransportDetailScreen> createState() => _TransportDetailScreenState();
}

class _TransportDetailScreenState extends State<_TransportDetailScreen> {
  late TransportInfo _info = widget.info;
  late Future<(List<Student>, List<AppUser>)> _people = _load();

  Future<(List<Student>, List<AppUser>)> _load() async {
    final students = await AdminApi.instance.listStudents(limit: 100);
    final staff = await AdminApi.instance.listStaff();
    return (students.data, staff.where((u) => u.role == 'Teacher').toList());
  }

  Future<void> _change(String kind, String memberId, bool add) async {
    try {
      final updated = add
          ? await AdminApi.instance.assignTransport(_info.id, kind, memberId)
          : await AdminApi.instance.unassignTransport(_info.id, kind, memberId);
      if (!mounted) return;
      setState(() => _info = updated);
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Failed: $e', type: ToastType.error);
    }
  }

  Future<void> _edit() async {
    final updated = await _showTransportForm(context, existing: _info);
    if (updated != null && mounted) setState(() => _info = updated);
  }

  Future<void> _delete() async {
    final ok = await showAppBottomSheet<bool>(
      context: context,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Delete ${_info.title ?? 'this transport'}?',
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark)),
            const SizedBox(height: 8),
            const Text('This removes the vehicle and all its assignments.',
                style: TextStyle(color: AppColors.textMuted)),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: SecondaryButton(
                    label: 'Cancel',
                    color: AppColors.textMuted,
                    onPressed: () => Navigator.pop(context, false),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: PrimaryButton(
                    label: 'Delete',
                    color: AppColors.danger,
                    onPressed: () => Navigator.pop(context, true),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await AdminApi.instance.deleteTransport(_info.id);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Failed: $e', type: ToastType.error);
    }
  }

  Future<void> _pick(String kind, List<(String, String)> candidates) async {
    final id = await showAppBottomSheet<String>(
      context: context,
      child: SizedBox(
        height: 420,
        child: candidates.isEmpty
            ? const EmptyState(
                emoji: '🔍',
                title: 'No one left to add',
                subtitle: 'Everyone is already assigned.',
              )
            : ListView(
                children: candidates
                    .map(
                      (c) => ListTile(
                        leading: InitialAvatar(
                          name: c.$2,
                          size: 36,
                          color: AppColors.adminPrimary,
                        ),
                        title: Text(c.$2),
                        onTap: () => Navigator.of(context).pop(c.$1),
                      ),
                    )
                    .toList(),
              ),
      ),
    );
    if (id != null) await _change(kind, id, true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: Text(_info.title ?? 'Transport'),
        actions: [
          IconButton(
            tooltip: 'Edit',
            icon: const Icon(Iconsax.edit, color: AppColors.textDark),
            onPressed: _edit,
          ),
          IconButton(
            tooltip: 'Delete',
            icon: const Icon(Iconsax.trash, color: AppColors.danger),
            onPressed: _delete,
          ),
        ],
      ),
      body: FutureBuilder<(List<Student>, List<AppUser>)>(
        future: _people,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return EmptyState(
              emoji: '🚌',
              title: 'Could not load people',
              subtitle: '${snap.error}',
              ctaLabel: 'Retry',
              onCta: () => setState(() {
                _people = _load();
              }),
            );
          }
          final (students, teachers) = snap.data!;
          final studentNames = {for (final s in students) s.id: s.fullName};
          final teacherNames = {
            for (final t in teachers) t.id: t.name.isEmpty ? t.email : t.name,
          };

          Widget section(
            String label,
            String kind,
            List<String> assigned,
            Map<String, String> names,
          ) {
            final candidates = names.entries
                .where((e) => !assigned.contains(e.key))
                .map((e) => (e.key, e.value))
                .toList();
            return AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '$label (${assigned.length})',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: () => _pick(kind, candidates),
                        icon: const Icon(Icons.add_rounded, size: 18),
                        label: const Text('Add'),
                      ),
                    ],
                  ),
                  if (assigned.isEmpty)
                    const Text(
                      'None assigned yet.',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 12,
                      ),
                    )
                  else
                    ...assigned.map(
                      (id) => ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: InitialAvatar(
                          name: names[id] ?? '?',
                          size: 34,
                          color: AppColors.adminPrimary,
                        ),
                        title: Text(names[id] ?? 'Unknown'),
                        trailing: IconButton(
                          icon: const Icon(
                            Icons.close_rounded,
                            size: 18,
                            color: AppColors.danger,
                          ),
                          onPressed: () => _change(kind, id, false),
                        ),
                      ),
                    ),
                ],
              ),
            );
          }

          // Vehicle / route / driver details (what parents see).
          final details = <(String, String?)>[
            ('Route', _info.routeName),
            ('Vehicle', _info.vehicleNumber),
            ('Driver', _info.driverName),
            ('Driver phone', _info.driverPhone),
          ].where((e) => (e.$2 ?? '').isNotEmpty).toList();

          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              if (details.isNotEmpty) ...[
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final (label, value) in details)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SizedBox(
                                width: 96,
                                child: Text(label,
                                    style: const TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 13)),
                              ),
                              Expanded(
                                child: Text(value!,
                                    style: const TextStyle(
                                        color: AppColors.textDark,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600)),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (_info.notes != null && _info.notes!.isNotEmpty) ...[
                Text(
                  _info.notes!,
                  style: const TextStyle(color: AppColors.textMuted),
                ),
                const SizedBox(height: 12),
              ],
              section(
                'Students',
                'student',
                _info.assignedStudents,
                studentNames,
              ),
              const SizedBox(height: 12),
              section('Teachers', 'staff', _info.assignedStaff, teacherNames),
            ],
          );
        },
      ),
    );
  }
}

// ── Holidays (A4) ──────────────────────────────────────────

/// Real school-holiday calendar (replaces the old "post an event tagged
/// Holiday" hack). Admin lists, adds and removes; every role reads the same
/// list for their calendars.
class AdminHolidaysScreen extends StatefulWidget {
  const AdminHolidaysScreen({super.key});

  @override
  State<AdminHolidaysScreen> createState() => _AdminHolidaysScreenState();
}

class _AdminHolidaysScreenState extends State<AdminHolidaysScreen> {
  late Future<List<HolidayModel>> _future = AdminApi.instance.listHolidays();

  void _reload() {
    setState(() {
      _future = AdminApi.instance.listHolidays();
    });
  }

  Future<void> _add() async {
    final saved = await showAdminHolidayForm(context);
    if (saved == true && mounted) _reload();
  }

  Future<void> _delete(HolidayModel h) async {
    try {
      await AdminApi.instance.deleteHoliday(h.id);
      if (!mounted) return;
      AppToast.show(context, 'Holiday removed', type: ToastType.success);
      _reload();
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Failed: $e', type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Holidays'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.adminPrimary,
        foregroundColor: Colors.white,
        onPressed: _add,
        icon: const Icon(Icons.add),
        label: const Text('Add'),
      ),
      body: FutureBuilder<List<HolidayModel>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return EmptyState(
              emoji: '🎌',
              title: 'Could not load holidays',
              subtitle: '${snap.error}',
              ctaLabel: 'Retry',
              onCta: _reload,
            );
          }
          final items = snap.data ?? const <HolidayModel>[];
          if (items.isEmpty) {
            return const EmptyState(
              emoji: '🎌',
              title: 'No holidays yet',
              subtitle: 'Tap Add to mark the first school holiday.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 96),
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final h = items[i];
                final past = h.date
                    .isBefore(DateTime(today.year, today.month, today.day));
                return Opacity(
                  opacity: past ? 0.55 : 1,
                  child: AppCard(
                    child: Row(
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            color: AppColors.adminPrimary.withValues(alpha: 0.10),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text('${h.date.day}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 18,
                                      color: AppColors.adminPrimary)),
                              Text(_monthAbbr(h.date.month),
                                  style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.adminPrimary)),
                            ],
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(h.title,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textDark)),
                              if (h.description != null &&
                                  h.description!.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(h.description!,
                                    style: const TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 12)),
                              ],
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Iconsax.trash,
                              color: AppColors.danger, size: 20),
                          onPressed: () => _delete(h),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

String _monthAbbr(int m) => const [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ][(m - 1).clamp(0, 11)];

/// Shared add-holiday sheet (used by the Holidays screen and the home quick
/// action). Returns true when a holiday was created.
Future<bool?> showAdminHolidayForm(BuildContext context) {
  final nameCtl = TextEditingController();
  DateTime date = DateTime.now().add(const Duration(days: 1));
  bool saving = false;
  return showAppBottomSheet<bool>(
    context: context,
    scrollable: true,
    child: StatefulBuilder(builder: (ctx, setSt) {
      Future<void> submit() async {
        final name = nameCtl.text.trim();
        if (name.isEmpty) {
          AppToast.show(ctx, 'Holiday name is required', type: ToastType.error);
          return;
        }
        setSt(() => saving = true);
        try {
          await AdminApi.instance.createHoliday(
            title: name,
            date:
                '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
          );
          if (ctx.mounted) Navigator.pop(ctx, true);
        } catch (e) {
          setSt(() => saving = false);
          if (ctx.mounted) AppToast.show(ctx, 'Failed: $e', type: ToastType.error);
        }
      }

      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Mark holiday',
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark)),
            const SizedBox(height: 12),
            TextField(
                controller: nameCtl,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                    labelText: 'Holiday name (e.g. Diwali)',
                    border: OutlineInputBorder())),
            const SizedBox(height: 8),
            ListTile(
              tileColor: Neu.bg,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppColors.mutedGray),
              ),
              title: const Text('Date'),
              subtitle: Text('${date.day}/${date.month}/${date.year}'),
              trailing: const Icon(Icons.calendar_today_rounded, size: 18),
              onTap: () async {
                final picked = await showDatePicker(
                  context: ctx,
                  initialDate: date,
                  firstDate: DateTime.now().subtract(const Duration(days: 1)),
                  lastDate: DateTime(2030, 12, 31),
                );
                if (picked != null) setSt(() => date = picked);
              },
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: saving ? 'Saving…' : 'Mark holiday',
              color: AppColors.adminPrimary,
              fullWidth: true,
              onPressed: saving ? null : submit,
            ),
          ],
        ),
      );
    }),
  );
}

// ── Leave management ───────────────────────────────────────

class AdminLeaveMgmtScreen extends StatefulWidget {
  const AdminLeaveMgmtScreen({super.key});

  @override
  State<AdminLeaveMgmtScreen> createState() => _AdminLeaveMgmtScreenState();
}

class _AdminLeaveMgmtScreenState extends State<AdminLeaveMgmtScreen> {
  late Future<List<LeaveModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = AdminApi.instance.listLeaves();
  }

  void _reload() => setState(() {
    _future = AdminApi.instance.listLeaves();
  });

  Future<void> _decide(LeaveModel l, String status) async {
    try {
      await AdminApi.instance.decideLeave(l.id, status);
      if (!mounted) return;
      AppToast.show(
        context,
        status == 'approved' ? 'Leave approved' : 'Leave rejected',
        type: status == 'approved' ? ToastType.success : ToastType.info,
      );
      _reload();
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Failed: $e', type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Leave Management'),
      ),
      body: FutureBuilder<List<LeaveModel>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return _ErrorView(error: snap.error, onRetry: _reload);
          }
          final leaves = snap.data ?? const <LeaveModel>[];
          if (leaves.isEmpty) {
            return const _EmptyView(message: 'No leave requests yet.');
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              padding: const EdgeInsets.all(20),
              children: [
                for (final l in leaves)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '${l.applicantRole == 'parent' ? 'Student leave' : 'Staff leave'} · ${l.type[0].toUpperCase()}${l.type.substring(1)}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              StatusChip(
                                label: switch (l.status) {
                                  'approved' => 'Approved',
                                  'rejected' => 'Rejected',
                                  'cancelled' => 'Cancelled',
                                  _ => 'Pending',
                                },
                                type: switch (l.status) {
                                  'approved' => ChipType.success,
                                  'rejected' || 'cancelled' => ChipType.danger,
                                  _ => ChipType.warning,
                                },
                              ),
                            ],
                          ),
                          if (l.applicantName != null) ...[
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                InitialAvatar(
                                  name: l.applicantName!,
                                  color: AppColors.adminPrimary,
                                  size: 30,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    '${l.applicantName} · ${_roleLabel(l.applicantRole)}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.textDark,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 4),
                          Text(
                            '${l.fromDate == null ? '' : Formatters.formatShortDate(l.fromDate!)} → ${l.toDate == null ? '' : Formatters.formatShortDate(l.toDate!)}${l.reason == null ? '' : ' · ${l.reason}'}',
                            style: const TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 12,
                            ),
                          ),
                          if (l.status == 'pending') ...[
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: PrimaryButton(
                                    label: 'Approve',
                                    color: AppColors.success,
                                    onPressed: () => _decide(l, 'approved'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: SecondaryButton(
                                    label: 'Reject',
                                    color: AppColors.danger,
                                    onPressed: () => _decide(l, 'rejected'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Settings (real logout) ─────────────────────────────────

class AdminSettingsScreen extends StatelessWidget {
  const AdminSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = AuthApi.instance.currentSession;
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Settings'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (session != null) ...[
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  InitialAvatar(
                    name: session.email.isEmpty ? 'Admin' : session.email,
                    color: AppColors.adminPrimary,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    session.email.isEmpty ? 'Admin' : session.email,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                  const Text(
                    'Admin',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
          _SettingsTile(
            icon: Iconsax.user,
            label: 'Edit profile',
            onTap: () => _openEditProfile(context),
          ),
          const SizedBox(height: 8),
          _SettingsTile(
            icon: Iconsax.building_4,
            label: 'School profile',
            onTap: () => _openSchoolProfile(context),
          ),
          const SizedBox(height: 8),
          _SettingsTile(
            icon: Iconsax.lock,
            label: 'Change password',
            onTap: () => _openChangePassword(context),
          ),
          const SizedBox(height: 8),
          _SettingsTile(
            icon: Iconsax.notification,
            label: 'Notifications',
            onTap: () => showAppBottomSheet<void>(
              context: context,
              child: const _AdminNotificationPrefsSheet(),
            ),
          ),
          const SizedBox(height: 8),
          _SettingsTile(
            icon: Iconsax.info_circle,
            label: 'Help & FAQ',
            onTap: () => _openHelp(context),
          ),
          const SizedBox(height: 8),
          _SettingsTile(
            icon: Iconsax.shield_tick,
            label: 'Privacy Policy',
            onTap: () => Navigator.of(context).push(
              neuRoute(
                const PrivacyPolicyScreen(accent: AppColors.adminPrimary),
              ),
            ),
          ),
          const SizedBox(height: 8),
          _SettingsTile(
            icon: Iconsax.logout,
            label: 'Logout',
            color: AppColors.danger,
            onTap: () => confirmLogout(context),
          ),
        ],
      ),
    );
  }
}

/// Admin notification opt-ins — reuses the shared P7 endpoint
/// (GET/PATCH /users/me/notification-prefs). Shows the school-oversight keys;
/// loads the full pref map and sends it back bar the toggles so other roles'
/// keys (e.g. a value set elsewhere) are preserved.
class _AdminNotificationPrefsSheet extends StatefulWidget {
  const _AdminNotificationPrefsSheet();
  @override
  State<_AdminNotificationPrefsSheet> createState() =>
      _AdminNotificationPrefsSheetState();
}

class _AdminNotificationPrefsSheetState
    extends State<_AdminNotificationPrefsSheet> {
  static const _items = [
    ('feeReminders', 'Fee alerts', 'Pending and overdue fee collections'),
    ('attendanceAlerts', 'Attendance alerts', 'Unmarked or low class attendance'),
    ('eventReminders', 'Event reminders', 'School events and holidays'),
  ];

  Map<String, bool>? _prefs;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final p = await AdminApi.instance.getNotificationPrefs();
      if (mounted) setState(() { _prefs = p; _error = null; });
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not load preferences');
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await AdminApi.instance.updateNotificationPrefs(_prefs!);
      if (!mounted) return;
      Navigator.of(context).pop();
      AppToast.show(context, 'Notification settings saved',
          type: ToastType.success);
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      AppToast.show(context, 'Could not save. Try again.',
          type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Notifications',
              style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark)),
          const SizedBox(height: 4),
          const Text('Choose which alerts you receive.',
              style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
          const SizedBox(height: 8),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(_error!,
                    style: const TextStyle(color: AppColors.textMuted)),
              ),
            )
          else if (_prefs == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(
                child:
                    CircularProgressIndicator(color: AppColors.adminPrimary),
              ),
            )
          else ...[
            for (final (key, title, sub) in _items)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14)),
                subtitle: Text(sub,
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 12)),
                value: _prefs![key] ?? true,
                activeThumbColor: AppColors.adminPrimary,
                onChanged: (v) => setState(() => _prefs![key] = v),
              ),
            const SizedBox(height: 8),
            PrimaryButton(
              label: _saving ? 'Saving…' : 'Save',
              color: AppColors.adminPrimary,
              fullWidth: true,
              onPressed: _saving ? null : _save,
            ),
          ],
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;
  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.textDark;
    return ListTile(
      tileColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      leading: Icon(icon, color: c),
      title: Text(label, style: TextStyle(color: c)),
      trailing: const Icon(
        Icons.chevron_right_rounded,
        color: AppColors.textMuted,
      ),
      onTap: onTap,
    );
  }
}

/// Admin edits their own school profile (A3) — name, contact, address,
/// academic year — via PATCH /schools/mine.
void _openSchoolProfile(BuildContext context) {
  showAppBottomSheet<void>(
    context: context,
    child: const _SchoolProfileSheet(),
  );
}

class _SchoolProfileSheet extends StatefulWidget {
  const _SchoolProfileSheet();
  @override
  State<_SchoolProfileSheet> createState() => _SchoolProfileSheetState();
}

class _SchoolProfileSheetState extends State<_SchoolProfileSheet> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _line1 = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _postal = TextEditingController();
  final _year = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _code;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in [
      _name, _email, _phone, _line1, _city, _state, _postal, _year,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final s = await AdminApi.instance.getMySchool();
      if (!mounted) return;
      _name.text = s.name;
      _email.text = s.contactEmail ?? '';
      _phone.text = s.contactPhone ?? '';
      _line1.text = s.line1 ?? '';
      _city.text = s.city ?? '';
      _state.text = s.state ?? '';
      _postal.text = s.postalCode ?? '';
      _year.text = s.currentAcademicYear ?? '';
      setState(() {
        _code = s.code;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() {
        _error = 'Could not load school profile';
        _loading = false;
      });
    }
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      AppToast.show(context, 'School name is required', type: ToastType.error);
      return;
    }
    setState(() => _saving = true);
    try {
      await AdminApi.instance.updateMySchool(
        name: _name.text.trim(),
        contactEmail: _email.text.trim(),
        contactPhone: _phone.text.trim(),
        line1: _line1.text.trim(),
        city: _city.text.trim(),
        state: _state.text.trim(),
        postalCode: _postal.text.trim(),
        currentAcademicYear: _year.text.trim(),
      );
      if (!mounted) return;
      Navigator.pop(context);
      AppToast.show(context, 'School profile updated', type: ToastType.success);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      AppToast.show(context, 'Failed: $e', type: ToastType.error);
    }
  }

  InputDecoration _dec(String l) => InputDecoration(
        labelText: l,
        border: const OutlineInputBorder(),
        isDense: true,
      );

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: _loading
          ? const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(child: CircularProgressIndicator()),
            )
          : _error != null
              ? Padding(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  child: Center(
                    child: Text(_error!,
                        style: const TextStyle(color: AppColors.textMuted)),
                  ),
                )
              : SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Expanded(
                            child: Text('School profile',
                                style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textDark)),
                          ),
                          if (_code != null)
                            Text(_code!,
                                style: const TextStyle(
                                    fontFamily: 'monospace',
                                    color: AppColors.textMuted,
                                    fontSize: 12)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextField(controller: _name, decoration: _dec('School name')),
                      const SizedBox(height: 8),
                      TextField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          decoration: _dec('Contact email')),
                      const SizedBox(height: 8),
                      TextField(
                          controller: _phone,
                          keyboardType: TextInputType.phone,
                          decoration: _dec('Contact phone')),
                      const SizedBox(height: 8),
                      TextField(controller: _line1, decoration: _dec('Address line')),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                              child: TextField(
                                  controller: _city, decoration: _dec('City'))),
                          const SizedBox(width: 8),
                          Expanded(
                              child: TextField(
                                  controller: _state, decoration: _dec('State'))),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                              child: TextField(
                                  controller: _postal,
                                  keyboardType: TextInputType.number,
                                  decoration: _dec('Postal code'))),
                          const SizedBox(width: 8),
                          Expanded(
                              child: TextField(
                                  controller: _year,
                                  decoration: _dec('Academic year'))),
                        ],
                      ),
                      const SizedBox(height: 16),
                      PrimaryButton(
                        label: _saving ? 'Saving…' : 'Save',
                        color: AppColors.adminPrimary,
                        fullWidth: true,
                        onPressed: _saving ? null : _save,
                      ),
                    ],
                  ),
                ),
    );
  }
}

void _openEditProfile(BuildContext context) {
  final session = AuthApi.instance.currentSession;
  final name = TextEditingController();
  final phone = TextEditingController();
  final email = session?.email ?? '';

  showAppBottomSheet<void>(
    context: context,
    scrollable: true,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Edit profile',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: name,
            decoration: const InputDecoration(
              labelText: 'Name',
              hintText: 'Enter your name',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: TextEditingController(text: email),
            readOnly: true,
            decoration: InputDecoration(
              labelText: 'Email',
              border: const OutlineInputBorder(),
              filled: true,
              fillColor: AppColors.textMuted.withValues(alpha: 0.08),
              suffixIcon: const Icon(
                Iconsax.lock,
                size: 16,
                color: AppColors.textMuted,
              ),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Phone',
              hintText: '+91 9876543210',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          PrimaryButton(
            label: 'Save',
            fullWidth: true,
            color: AppColors.adminPrimary,
            onPressed: () async {
              try {
                await AdminApi.instance.updateMyProfile(
                  name: name.text.isNotEmpty ? name.text.trim() : null,
                  phone: phone.text.isNotEmpty ? phone.text.trim() : null,
                );
                if (!context.mounted) return;
                Navigator.of(context).pop();
                AppToast.show(
                  context,
                  'Profile updated',
                  type: ToastType.success,
                );
              } catch (e) {
                if (!context.mounted) return;
                AppToast.show(
                  context,
                  'Failed to update profile',
                  type: ToastType.error,
                );
              }
            },
          ),
        ],
      ),
    ),
  );
}

void _openChangePassword(BuildContext context) {
  final newPw = TextEditingController();
  final confirm = TextEditingController();

  showAppBottomSheet<void>(
    context: context,
    scrollable: true,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Change password',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: newPw,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'New password',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: confirm,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Confirm new password',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          PrimaryButton(
            label: 'Update password',
            fullWidth: true,
            color: AppColors.adminPrimary,
            onPressed: () async {
              if (newPw.text != confirm.text) {
                AppToast.show(
                  context,
                  'Passwords do not match',
                  type: ToastType.error,
                );
                return;
              }
              if (newPw.text.length < 8) {
                AppToast.show(
                  context,
                  'Password must be at least 8 characters',
                  type: ToastType.error,
                );
                return;
              }
              try {
                await AdminApi.instance.updateMyProfile(password: newPw.text);
                if (!context.mounted) return;
                Navigator.of(context).pop();
                AppToast.show(
                  context,
                  'Password updated',
                  type: ToastType.success,
                );
              } catch (e) {
                if (!context.mounted) return;
                AppToast.show(
                  context,
                  'Failed to update password',
                  type: ToastType.error,
                );
              }
            },
          ),
        ],
      ),
    ),
  );
}

void _openHelp(BuildContext context) {
  const faqs = [
    (
      'How do I add a student?',
      'Go to Students tab → tap + → fill in the form with parent phone number.',
    ),
    (
      'How do I mark attendance?',
      'Go to Attendance tab → select a class → tap P/A for each student.',
    ),
    (
      'How do I collect fees?',
      'Go to Fees tab → tap on an outstanding invoice → Record payment.',
    ),
    (
      'How do I send a circular?',
      'Go to More → Communication → Create circular or alert.',
    ),
  ];
  showAppBottomSheet<void>(
    context: context,
    scrollable: true,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Help & FAQ',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 8),
          for (final f in faqs) ...[
            const SizedBox(height: 8),
            Text(
              f.$1,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              f.$2,
              style: const TextStyle(color: AppColors.textMuted, height: 1.4),
            ),
          ],
        ],
      ),
    ),
  );
}

// ── Reports ────────────────────────────────────────────────

class AdminReportsScreen extends StatefulWidget {
  const AdminReportsScreen({super.key});
  @override
  State<AdminReportsScreen> createState() => _AdminReportsScreenState();
}

class _AdminReportsScreenState extends State<AdminReportsScreen> {
  AdminDashboardStats? _stats;
  FeeCollectionSummary? _collection;
  FeeOutstandingSummary? _outstanding;
  List<SchoolClass>? _classes;
  bool _loading = true;

  // Today's teacher attendance, computed from the roster + today's records.
  int _teacherTotal = 0;
  int _teacherMarked = 0;
  int _teacherPresent = 0;
  int _teacherAbsent = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final today = DateTime.now().toIso8601String().split('T').first;
    try {
      final results = await Future.wait([
        AdminApi.instance.getDashboardStats(),
        AdminApi.instance.collectionSummary(),
        AdminApi.instance.outstandingSummary(),
        AdminApi.instance.listClasses(),
        AdminApi.instance.listStaff(),
        AdminApi.instance.getStaffAttendance(today),
      ]);
      if (!mounted) return;
      final staff = results[4] as List<AppUser>;
      final records = results[5] as List<StaffAttendanceRecord>;
      // Same rule as the Attendance → Teachers tab: only teachers are marked.
      final teacherIds = {
        for (final u in staff)
          if (u.role == 'Teacher') u.id,
      };
      final statusById = {
        for (final r in records)
          if (teacherIds.contains(r.staffId)) r.staffId: r.status,
      };
      setState(() {
        _stats = results[0] as AdminDashboardStats;
        _collection = results[1] as FeeCollectionSummary;
        _outstanding = results[2] as FeeOutstandingSummary;
        _classes = results[3] as List<SchoolClass>;
        _teacherTotal = teacherIds.length;
        _teacherMarked = statusById.length;
        _teacherPresent =
            statusById.values.where((s) => s == 'present').length;
        _teacherAbsent = statusById.values.where((s) => s == 'absent').length;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Reports'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(20),
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                children: [
                  // ── Quick stats row ──
                  if (_stats != null) ...[
                    Row(
                      children: [
                        _StatCard(
                          'Students',
                          '${_stats!.activeStudents}',
                          Iconsax.people,
                          AppColors.adminPrimary,
                        ),
                        const SizedBox(width: 10),
                        _StatCard(
                          'Staff',
                          '${_stats!.staffCount}',
                          Iconsax.teacher,
                          AppColors.info,
                        ),
                        const SizedBox(width: 10),
                        _StatCard(
                          'Classes',
                          '${_classes?.length ?? 0}',
                          Iconsax.book,
                          AppColors.warning,
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],

                  // ── Student attendance summary ──
                  if (_stats != null) ...[
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Iconsax.people,
                                  size: 18, color: AppColors.adminPrimary),
                              SizedBox(width: 8),
                              Text(
                                'Today\'s Student Attendance',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              _AttPill(
                                'Present',
                                _stats!.presentToday,
                                AppColors.success,
                              ),
                              const SizedBox(width: 10),
                              _AttPill(
                                'Absent',
                                _stats!.absentToday,
                                AppColors.danger,
                              ),
                              const SizedBox(width: 10),
                              _AttPill(
                                'Unmarked',
                                _stats!.attendanceNotMarked,
                                AppColors.warning,
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          _ProgressRow(
                            label: 'Marked',
                            value: _stats!.attendanceMarked,
                            total: _stats!.attendanceTotal,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],

                  // ── Teacher attendance summary ──
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Iconsax.teacher,
                                size: 18, color: AppColors.info),
                            SizedBox(width: 8),
                            Text(
                              'Today\'s Teacher Attendance',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        if (_teacherTotal == 0)
                          const Text(
                            'No teacher accounts yet.',
                            style: TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 13,
                            ),
                          )
                        else ...[
                          Row(
                            children: [
                              _AttPill(
                                'Present',
                                _teacherPresent,
                                AppColors.success,
                              ),
                              const SizedBox(width: 10),
                              _AttPill(
                                'Absent',
                                _teacherAbsent,
                                AppColors.danger,
                              ),
                              const SizedBox(width: 10),
                              _AttPill(
                                'Unmarked',
                                _teacherTotal - _teacherMarked,
                                AppColors.warning,
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          _ProgressRow(
                            label: 'Marked',
                            value: _teacherMarked,
                            total: _teacherTotal,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // ── Fee collection ──
                  if (_collection != null && _outstanding != null) ...[
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Fee Summary',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: _FeeStat(
                                  'Collected',
                                  '₹${_collection!.totalCollected.toStringAsFixed(0)}',
                                  Iconsax.money_recive,
                                  AppColors.success,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _FeeStat(
                                  'Outstanding',
                                  '₹${_outstanding!.totalOutstanding.toStringAsFixed(0)}',
                                  Iconsax.money_send,
                                  AppColors.danger,
                                ),
                              ),
                            ],
                          ),
                          if (_collection!.paymentCount > 0 ||
                              _outstanding!.outstandingInvoices > 0) ...[
                            const SizedBox(height: 10),
                            Text(
                              '${_collection!.paymentCount} payments received · ${_outstanding!.outstandingInvoices} invoices pending',
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],

                  // ── Class enrollment ──
                  if (_classes != null && _classes!.isNotEmpty) ...[
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Enrollment by Class',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                          const SizedBox(height: 12),
                          ..._classes!.map(
                            (c) => Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: _ProgressRow(
                                label: c.displayName,
                                value: c.enrolled,
                                total: c.capacity,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard(this.label, this.value, this.icon, this.color);
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: AppCard(
        child: Column(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            Text(
              label,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

class _AttPill extends StatelessWidget {
  const _AttPill(this.label, this.value, this.color);
  final String label;
  final int value;
  final Color color;
  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              '$value',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: color.withValues(alpha: 0.8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeeStat extends StatelessWidget {
  const _FeeStat(this.label, this.value, this.icon, this.color);
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    color: color.withValues(alpha: 0.7),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressRow extends StatelessWidget {
  const _ProgressRow({
    required this.label,
    required this.value,
    required this.total,
  });
  final String label;
  final int value;
  final int total;
  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? (value / total) : 0.0;
    return Row(
      children: [
        SizedBox(
          width: 100,
          child: Text(
            label,
            style: const TextStyle(fontSize: 13),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 8,
              backgroundColor: AppColors.mutedGray.withValues(alpha: 0.3),
              valueColor: AlwaysStoppedAnimation<Color>(
                pct >= 0.9
                    ? AppColors.success
                    : pct >= 0.5
                    ? AppColors.warning
                    : AppColors.danger,
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 48,
          child: Text(
            '$value/$total',
            textAlign: TextAlign.end,
            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
          ),
        ),
      ],
    );
  }
}

// ── Shared helpers ─────────────────────────────────────────

/// Turns a backend role string ('teacher', 'super_admin') into a label.
String _roleLabel(String? role) {
  if (role == null || role.isEmpty) return 'Staff';
  return role
      .split('_')
      .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({required this.controller, required this.onChanged});
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    // Carved into the page, matching the parent/teacher search fields.
    return NeuInset(
      radius: 24,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: SizedBox(
        height: 48,
        child: Row(
          children: [
            const Icon(
              Iconsax.search_normal,
              size: 20,
              color: AppColors.textMuted,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: controller,
                onChanged: onChanged,
                decoration: const InputDecoration(
                  hintText: 'Search students',
                  border: InputBorder.none,
                  isDense: true,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView({this.message = 'No students yet. Add one to get started.'});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('📋', style: TextStyle(fontSize: 48)),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.error, required this.onRetry});
  final Object? error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Iconsax.warning_2, color: AppColors.danger, size: 40),
            const SizedBox(height: 12),
            const Text(
              'Could not load data.',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              '$error',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            SecondaryButton(
              label: 'Try again',
              color: AppColors.adminPrimary,
              onPressed: onRetry,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Gallery ──────────────────────────────────────────────────

class AdminGalleryScreen extends StatefulWidget {
  const AdminGalleryScreen({super.key});
  @override
  State<AdminGalleryScreen> createState() => _AdminGalleryScreenState();
}

class _AdminGalleryScreenState extends State<AdminGalleryScreen> {
  late Future<List<GalleryItem>> _future;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _future = AdminApi.instance.listGallery();
  }

  void _reload() {
    setState(() {
      _future = AdminApi.instance.listGallery();
    });
  }

  Future<void> _pickAndUpload() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 1920,
    );
    if (picked == null || !mounted) return;

    final captionCtl = TextEditingController();
    final caption = await showAppBottomSheet<String>(
      context: context,
      scrollable: true,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Add caption',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: captionCtl,
              autofocus: true,
              decoration: const InputDecoration(
                hintText: 'e.g. Annual Day photos',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: 'Upload',
              color: AppColors.adminPrimary,
              fullWidth: true,
              onPressed: () =>
                  Navigator.of(context).pop(captionCtl.text.trim()),
            ),
          ],
        ),
      ),
    );

    if (!mounted) return;
    setState(() => _uploading = true);
    try {
      await AdminApi.instance.uploadGallery(
        filePath: picked.path,
        title: (caption ?? '').isNotEmpty ? caption : null,
      );
      if (!mounted) return;
      AppToast.show(context, 'Uploaded to gallery', type: ToastType.success);
      _reload();
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Upload failed: $e', type: ToastType.error);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _openDetail(GalleryItem item) async {
    final deleted = await Navigator.of(
      context,
    ).push<bool>(neuRoute(_AdminGalleryDetail(item: item)));
    if (deleted == true && mounted) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text(
          'Gallery',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            color: AppColors.textDark,
          ),
        ),
      ),
      body: FutureBuilder<List<GalleryItem>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return EmptyState(
              emoji: '📸',
              title: 'Could not load gallery',
              subtitle: '${snap.error}',
              ctaLabel: 'Retry',
              onCta: _reload,
            );
          }
          final items = snap.data ?? const <GalleryItem>[];
          return Stack(
            children: [
              if (items.isEmpty)
                const EmptyState(
                  emoji: '📸',
                  title: 'No photos yet',
                  subtitle: 'Tap Upload to add the first photo.',
                )
              else
                RefreshIndicator(
                  onRefresh: () async => _reload(),
                  child: GridView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                        ),
                    itemCount: items.length,
                    itemBuilder: (_, i) {
                      final item = items[i];
                      return GestureDetector(
                        onTap: () => _openDetail(item),
                        // Long-press deletes, which is the familiar gesture
                        // for a photo grid. It still asks first.
                        onLongPress: () async {
                          if (await deleteGalleryItem(context, item)) {
                            _reload();
                          }
                        },
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: AppCard(
                            padding: EdgeInsets.zero,
                            child: _AdminGalleryThumbnail(item: item),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              Positioned(
                right: 20,
                bottom: 24,
                child: FloatingActionButton.extended(
                  onPressed: _uploading ? null : _pickAndUpload,
                  backgroundColor: AppColors.adminPrimary,
                  foregroundColor: Colors.white,
                  icon: Icon(
                    _uploading
                        ? Icons.hourglass_top_rounded
                        : Icons.add_a_photo_rounded,
                  ),
                  label: Text(_uploading ? 'Uploading…' : 'Upload'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Confirms, then removes a gallery item and the file behind it.
///
/// Shared by the grid's long-press and the detail screen's delete button, so
/// both routes ask the same question and report the same way. Returns whether
/// the item is gone, letting the caller refresh or pop.
Future<bool> deleteGalleryItem(BuildContext context, GalleryItem item) async {
  final messenger = ScaffoldMessenger.maybeOf(context);
  final label = (item.title?.trim().isNotEmpty ?? false)
      ? '“${item.title!.trim()}”'
      : 'this photo';

  final confirmed = await confirmDestructive(
    context,
    title: 'Delete $label?',
    message:
        'It will be removed from the gallery for parents too, and the file '
        'itself is deleted. This cannot be undone.',
    confirmLabel: 'Delete',
    icon: Iconsax.gallery_remove,
  );
  if (!confirmed) return false;

  try {
    await AdminApi.instance.deleteGallery(item.id);
    messenger?.showSnackBar(
      const SnackBar(content: Text('Deleted from gallery')),
    );
    return true;
  } catch (_) {
    messenger?.showSnackBar(
      const SnackBar(content: Text('Could not delete — please try again')),
    );
    return false;
  }
}

class _AdminGalleryThumbnail extends StatelessWidget {
  const _AdminGalleryThumbnail({required this.item});
  final GalleryItem item;

  @override
  Widget build(BuildContext context) {
    final url = item.resolvedThumbnailUrl ?? item.resolvedUrl;
    if (url != null && url.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Image.network(
          url,
          fit: BoxFit.cover,
          height: double.infinity,
          errorBuilder: (_, e, s) => _placeholder(),
        ),
      );
    }
    return _placeholder();
  }

  Widget _placeholder() {
    final emoji = item.mediaType == 'video' ? '🎬' : '🖼️';
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 28)),
          if (item.title != null && item.title!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                item.title!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 9, color: AppColors.textMuted),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _AdminGalleryDetail extends StatelessWidget {
  const _AdminGalleryDetail({required this.item});
  final GalleryItem item;

  @override
  Widget build(BuildContext context) {
    final url = item.resolvedUrl;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          item.title ?? 'Photo',
          style: const TextStyle(color: Colors.white),
        ),
        actions: [
          IconButton(
            tooltip: 'Delete',
            icon: const Icon(Iconsax.trash, color: Colors.white),
            onPressed: () async {
              // Pops with `true` so the grid behind knows to refresh — and so
              // nobody is left staring at a photo that no longer exists.
              if (await deleteGalleryItem(context, item)) {
                if (context.mounted) Navigator.of(context).pop(true);
              }
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: url != null && url.isNotEmpty
                  ? InteractiveViewer(
                      child: Image.network(
                        url,
                        fit: BoxFit.contain,
                        errorBuilder: (_, e, s) => const Icon(
                          Icons.broken_image_rounded,
                          color: Colors.white54,
                          size: 64,
                        ),
                      ),
                    )
                  : const Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('🖼️', style: TextStyle(fontSize: 80)),
                        SizedBox(height: 12),
                        Text(
                          'Image not available',
                          style: TextStyle(color: Colors.white54, fontSize: 14),
                        ),
                      ],
                    ),
            ),
          ),
          if (item.notes != null && item.notes!.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              color: Colors.black87,
              child: Text(
                item.notes!,
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
            ),
          if (item.createdAt != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                Formatters.formatDate(item.createdAt!),
                style: const TextStyle(color: Colors.white38, fontSize: 11),
              ),
            ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax/iconsax.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/models/student.dart';
import '../../../core/network/admin_api.dart'
    show SchoolClass, AttendanceClassSummary;
import '../../../core/network/auth_api.dart';
import '../../../core/network/teacher_api.dart';
import '../../shared/confirm_logout.dart';
import '../../shared/privacy_policy_screen.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/neu.dart';
import 'teacher_messages.dart';

/// Daily Preschool Updates — teacher posts meal / nap / activity / mood
/// updates for one student; the parent sees them in their diary.
class TeacherDiaryScreen extends StatefulWidget {
  const TeacherDiaryScreen({super.key, required this.student});
  final Student student;

  @override
  State<TeacherDiaryScreen> createState() => _TeacherDiaryScreenState();
}

class _TeacherDiaryScreenState extends State<TeacherDiaryScreen> {
  bool _sending = false;

  // Meal
  String? _mealType = 'lunch';
  String _mealAmount = 'all';
  final _menuCtl = TextEditingController();
  // Nap
  String? _napQuality;
  // Activity
  final Set<String> _activities = {};
  // Mood / observation
  String? _mood;
  final _remark = TextEditingController();
  // Health note
  String _healthType = 'general';
  final _healthCtl = TextEditingController();

  static const _mealTypes = [
    'breakfast',
    'morning_snack',
    'lunch',
    'afternoon_snack',
  ];
  static const _mealAmounts = ['all', 'most', 'some', 'none', 'refused'];
  static const _healthTypes = [
    'general',
    'temperature',
    'medication',
    'incident',
    'symptom',
  ];
  static const _napQualities = ['sound', 'restless', 'no_nap'];
  static const _moods = [
    'happy',
    'calm',
    'energetic',
    'tired',
    'cranky',
    'upset',
  ];
  static const _activitiesList = [
    'Drawing',
    'Story time',
    'Outdoor play',
    'Music',
    'Dance',
    'Blocks',
    'Yoga',
    'Cooking',
  ];

  @override
  void dispose() {
    _remark.dispose();
    _menuCtl.dispose();
    _healthCtl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: Text('Daily Update · ${widget.student.firstName}'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          _SectionTitle('Meal'),
          const SizedBox(height: 8),
          NeuCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: _mealTypes
                      .map(
                        (t) => NeuChip(
                          label: _pretty(t),
                          selected: _mealType == t,
                          onTap: () => setState(
                            () => _mealType = _mealType == t ? null : t,
                          ),
                        ),
                      )
                      .toList(),
                ),
                if (_mealType != null) ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: _menuCtl,
                    decoration: const InputDecoration(
                      labelText: 'Menu (e.g. Rice & dal)',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: _mealAmounts
                        .map(
                          (a) => NeuChip(
                            label: 'Ate ${_pretty(a)}',
                            selected: _mealAmount == a,
                            onTap: () => setState(() => _mealAmount = a),
                          ),
                        )
                        .toList(),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          _SectionTitle('Nap'),
          const SizedBox(height: 8),
          NeuCard(
            child: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: _napQualities
                  .map(
                    (q) => NeuChip(
                      label: _pretty(q),
                      selected: _napQuality == q,
                      onTap: () => setState(
                        () => _napQuality = _napQuality == q ? null : q,
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 16),
          _SectionTitle('Activities'),
          const SizedBox(height: 8),
          NeuCard(
            child: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: _activitiesList
                  .map(
                    (a) => NeuChip(
                      label: a,
                      selected: _activities.contains(a),
                      onTap: () => setState(() {
                        _activities.contains(a)
                            ? _activities.remove(a)
                            : _activities.add(a);
                      }),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 16),
          _SectionTitle('Mood & remark'),
          const SizedBox(height: 8),
          NeuCard(
            child: Column(
              children: [
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: _moods
                      .map(
                        (m) => NeuChip(
                          label: _pretty(m),
                          selected: _mood == m,
                          onTap: () =>
                              setState(() => _mood = _mood == m ? null : m),
                        ),
                      )
                      .toList(),
                ),
                TextField(
                  controller: _remark,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    hintText: 'How was the day? Anything special to share...',
                    border: InputBorder.none,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _SectionTitle('Health note (optional)'),
          const SizedBox(height: 8),
          NeuCard(
            child: Column(
              children: [
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: _healthTypes
                      .map(
                        (h) => NeuChip(
                          label: _pretty(h),
                          selected: _healthType == h,
                          onTap: () => setState(() => _healthType = h),
                        ),
                      )
                      .toList(),
                ),
                TextField(
                  controller: _healthCtl,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    hintText: 'e.g. Mild fever after lunch, gave rest…',
                    border: InputBorder.none,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          NeuButton(
            label: _sending ? 'Sending…' : 'Send to parent',
            icon: Icons.send_rounded,
            onPressed: _sending ? null : _send,
          ),
        ],
      ),
    );
  }

  static String _pretty(String v) => v
      .split('_')
      .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');

  Future<void> _send() async {
    final api = TeacherApi.instance;
    final hasMeal = _mealType != null && _menuCtl.text.trim().isNotEmpty;
    final hasNap = _napQuality != null;
    final hasActivity = _activities.isNotEmpty;
    final hasMood = _mood != null && _remark.text.trim().isNotEmpty;
    final hasHealth = _healthCtl.text.trim().isNotEmpty;

    if (!hasMeal && !hasNap && !hasActivity && !hasMood && !hasHealth) {
      AppToast.show(
        context,
        'Nothing to send — fill in at least one section',
        type: ToastType.error,
      );
      return;
    }

    setState(() => _sending = true);
    final id = widget.student.id;
    var failed = false;
    try {
      if (hasMeal) {
        await api.postMeal(
          studentId: id,
          mealType: _mealType!,
          menu: _menuCtl.text.trim(),
          amountEaten: _mealAmount,
        );
      }
      if (hasNap) {
        await api.postNap(studentId: id, quality: _napQuality);
      }
      if (hasActivity) {
        await api.postActivity(
          studentId: id,
          title: _activities.join(', '),
          category: 'play',
        );
      }
      if (hasMood) {
        await api.postObservation(
          studentId: id,
          mood: _mood!,
          observation: _remark.text.trim(),
        );
      }
      if (hasHealth) {
        await api.postHealth(
          studentId: id,
          type: _healthType,
          description: _healthCtl.text.trim(),
        );
      }
    } catch (_) {
      failed = true;
    }
    if (!mounted) return;
    setState(() => _sending = false);
    AppToast.show(
      context,
      failed
          ? 'Could not send the update — please try again'
          : 'Diary shared with ${widget.student.firstName}\'s parent',
      type: failed ? ToastType.error : ToastType.success,
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;
  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontWeight: FontWeight.w700,
        fontSize: 14,
        color: AppColors.textDark,
      ),
    );
  }
}

class TeacherGalleryUploadScreen extends StatefulWidget {
  const TeacherGalleryUploadScreen({super.key});
  @override
  State<TeacherGalleryUploadScreen> createState() =>
      _TeacherGalleryUploadScreenState();
}

class _TeacherGalleryUploadScreenState
    extends State<TeacherGalleryUploadScreen> {
  late Future<List<GalleryItem>> _future;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _future = TeacherApi.instance.listGallery();
  }

  void _reload() {
    setState(() {
      _future = TeacherApi.instance.listGallery();
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
                hintText: 'e.g. Art class — finger painting',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: 'Upload',
              color: AppColors.teacherPrimary,
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
      await TeacherApi.instance.uploadGallery(
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

  void _openDetail(GalleryItem item) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => _TeacherGalleryDetail(item: item)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Gallery'),
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
                        child: NeuBox(
                          radius: 14,
                          child: _TeacherGalleryThumbnail(item: item),
                        ),
                      );
                    },
                  ),
                ),
              Positioned(
                right: 20,
                bottom: 24,
                child: NeuButton(
                  label: _uploading ? 'Uploading…' : 'Upload',
                  icon: Icons.add_a_photo_rounded,
                  fullWidth: false,
                  onPressed: _uploading ? null : _pickAndUpload,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _TeacherGalleryThumbnail extends StatelessWidget {
  const _TeacherGalleryThumbnail({required this.item});
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

class _TeacherGalleryDetail extends StatelessWidget {
  const _TeacherGalleryDetail({required this.item});
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
      ),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: url != null && url.isNotEmpty
                  ? ZoomableImage(url: url)
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

class TeacherMoreScreen extends StatelessWidget {
  const TeacherMoreScreen({super.key});

  static const _tiles = [
    ('Messages', '💬', AppColors.info),
    ('PTM', '🤝', AppColors.success),
    ('Circulars', '📣', AppColors.teacherPrimary),
    ('Leave', '🌴', AppColors.warning),
    ('Gallery', '📸', AppColors.danger),
    ('Transport', '🚌', AppColors.adminPrimary),
    ('Settings', '⚙️', AppColors.textMuted),
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
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 110),
        physics: const BouncingScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 16,
          crossAxisSpacing: 16,
          childAspectRatio: 1.05,
        ),
        itemCount: _tiles.length,
        itemBuilder: (_, i) {
          final t = _tiles[i];
          return NeuTilt(
                maxTilt: 0.05,
                child: NeuCard(
                  onTap: () => _open(context, t.$1),
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      NeuBox(
                        inset: true,
                        shape: BoxShape.circle,
                        child: SizedBox(
                          width: 62,
                          height: 62,
                          child: Center(
                            child: Text(
                              t.$2,
                              style: const TextStyle(fontSize: 30),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        t.$1,
                        style: TextStyle(
                          color: t.$3,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              )
              .animate(delay: (40 * i).ms)
              .fadeIn(duration: 300.ms, curve: Curves.easeOut)
              .slideY(begin: 0.06, curve: Curves.easeOutCubic);
        },
      ),
    );
  }

  void _open(BuildContext context, String label) {
    switch (label) {
      case 'Messages':
        Navigator.push(context, neuRoute(const TeacherMessagesScreen()));
        break;
      case 'Gallery':
        Navigator.push(context, neuRoute(const TeacherGalleryUploadScreen()));
        break;
      case 'PTM':
        Navigator.push(context, neuRoute(const TeacherPtmScreen()));
        break;
      case 'Circulars':
        Navigator.push(context, neuRoute(const TeacherCircularsScreen()));
        break;
      case 'Leave':
        Navigator.push(context, neuRoute(const TeacherLeaveScreen()));
        break;
      case 'Transport':
        Navigator.push(context, neuRoute(const TeacherTransportScreen()));
        break;
      case 'Settings':
        Navigator.push(context, neuRoute(const TeacherSettingsScreen()));
        break;
    }
  }
}

/// Transport — read-only vehicle info for the teacher's school.
class TeacherTransportScreen extends StatefulWidget {
  const TeacherTransportScreen({super.key});
  @override
  State<TeacherTransportScreen> createState() => _TeacherTransportScreenState();
}

class _TeacherTransportScreenState extends State<TeacherTransportScreen> {
  TransportInfo? _info;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final info = await TeacherApi.instance.getMyTransport();
      if (!mounted) return;
      setState(() {
        _info = info;
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
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Transport'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _info == null
              ? const EmptyState(
                  emoji: '🚌',
                  title: 'No transport assigned',
                  subtitle: 'The school hasn\'t added any vehicles yet.',
                )
              : _buildContent(),
    );
  }

  Widget _buildContent() {
    final info = _info!;
    final title = info.title ?? 'School Transport';
    final route = info.routeName;
    final vehicle = info.vehicleNumber;
    final driver = info.driverName;
    final phone = info.driverPhone;
    final notes = info.notes;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.all(20),
        children: [
          NeuCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  children: [
                    const Text('🚌', style: TextStyle(fontSize: 40)),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 18)),
                          if (route != null && route.isNotEmpty)
                            Text(route,
                                style: const TextStyle(
                                    color: AppColors.textMuted)),
                          if (vehicle != null && vehicle.isNotEmpty)
                            Text(vehicle,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w500,
                                    color: AppColors.textMuted)),
                        ],
                      ),
                    ),
                  ],
                ),
                if (driver != null && driver.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      const NeuIconWell(
                          icon: Iconsax.user, size: 36, iconSize: 16),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Driver',
                                style: TextStyle(
                                    color: AppColors.textMuted, fontSize: 11)),
                            Text(driver,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                      if (phone != null && phone.isNotEmpty)
                        GestureDetector(
                          onTap: () => AppToast.show(context,
                              'Calling $phone…',
                              type: ToastType.info),
                          child: const NeuIconWell(
                              icon: Iconsax.call,
                              size: 36,
                              iconSize: 16,
                              color: AppColors.success),
                        ),
                    ],
                  ),
                ],
                if (notes != null && notes.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 8),
                  Text(notes,
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 13)),
                ],
                if (_info!.assignedStudents.isNotEmpty ||
                    _info!.assignedStaff.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      if (_info!.assignedStudents.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.teacherPrimary
                                .withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${_info!.assignedStudents.length} students',
                            style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.teacherPrimary,
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                      if (_info!.assignedStaff.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.info.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${_info!.assignedStaff.length} staff',
                            style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.info,
                                fontWeight: FontWeight.w600),
                          ),
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

/// Circulars — teachers can read school notices and publish their own.
class TeacherCircularsScreen extends StatefulWidget {
  const TeacherCircularsScreen({super.key});
  @override
  State<TeacherCircularsScreen> createState() => _TeacherCircularsScreenState();
}

class _TeacherCircularsScreenState extends State<TeacherCircularsScreen> {
  late Future<List<CircularModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = TeacherApi.instance.getCirculars();
  }

  void _reload() {
    setState(() {
      _future = TeacherApi.instance.getCirculars();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Circulars'),
      ),
      floatingActionButton: NeuButton(
        label: 'New circular',
        icon: Icons.add,
        fullWidth: false,
        onPressed: _openNew,
      ),
      body: FutureBuilder<List<CircularModel>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final items = snap.data ?? const <CircularModel>[];
          if (items.isEmpty) {
            return const EmptyState(
              emoji: '📣',
              title: 'No circulars yet',
              subtitle: 'School notices will appear here.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 90),
              children: [
                for (final c in items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: NeuCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  c.pinned ? '📌 ${c.title}' : c.title,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                  ),
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
                          const SizedBox(height: 6),
                          Text(
                            c.body,
                            style: const TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 13,
                              height: 1.4,
                            ),
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

  void _openNew() {
    final title = TextEditingController();
    final body = TextEditingController();
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
              'New circular',
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
            TextField(
              controller: body,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Message',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            Builder(
              builder: (ctx) {
                return PrimaryButton(
                  label: 'Publish to parents',
                  color: AppColors.teacherPrimary,
                  fullWidth: true,
                  onPressed: () async {
                    if (title.text.trim().isEmpty || body.text.trim().isEmpty) {
                      AppToast.show(
                        ctx,
                        'Title and message are required',
                        type: ToastType.error,
                      );
                      return;
                    }
                    try {
                      await TeacherApi.instance.createCircular(
                        title: title.text.trim(),
                        body: body.text.trim(),
                        audience: 'parents',
                      );
                      if (!ctx.mounted) return;
                      Navigator.pop(ctx);
                      if (!mounted) return;
                      AppToast.show(
                        context,
                        'Circular published',
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

class TeacherLeaveScreen extends StatefulWidget {
  const TeacherLeaveScreen({super.key});
  @override
  State<TeacherLeaveScreen> createState() => _TeacherLeaveScreenState();
}

class _TeacherLeaveScreenState extends State<TeacherLeaveScreen> {
  DateTime? _from;
  DateTime? _to;
  String _type = 'casual';
  final _reason = TextEditingController();
  late Future<List<LeaveModel>> _future;

  static const _types = ['sick', 'casual', 'vacation', 'other'];

  @override
  void initState() {
    super.initState();
    _future = TeacherApi.instance.myLeaves();
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pick(BuildContext context, bool isFrom) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isFrom
          ? (_from ?? DateTime.now())
          : (_to ?? _from ?? DateTime.now()),
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime(2027, 12, 31),
    );
    if (picked != null) {
      setState(() {
        if (isFrom) {
          _from = picked;
        } else {
          _to = picked;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = _from != null && _to != null && _reason.text.isNotEmpty;
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Apply for leave'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          NeuCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: _types
                      .map(
                        (t) => NeuChip(
                          label: t[0].toUpperCase() + t.substring(1),
                          selected: _type == t,
                          onTap: () => setState(() => _type = t),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 8),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('From'),
                  subtitle: Text(
                    _from == null
                        ? 'Select date'
                        : _from.toString().split(' ').first,
                  ),
                  trailing: const Icon(Icons.calendar_today_rounded),
                  onTap: () => _pick(context, true),
                ),
                const Divider(height: 1),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('To'),
                  subtitle: Text(
                    _to == null
                        ? 'Select date'
                        : _to.toString().split(' ').first,
                  ),
                  trailing: const Icon(Icons.calendar_today_rounded),
                  onTap: () => _pick(context, false),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _reason,
                  maxLines: 3,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    labelText: 'Reason',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                NeuButton(
                  label: 'Submit',
                  onPressed: canSubmit ? _submit : null,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          FutureBuilder<List<LeaveModel>>(
            future: _future,
            builder: (context, snap) {
              final items = snap.data ?? const <LeaveModel>[];
              if (items.isEmpty) return const SizedBox.shrink();
              return NeuCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'My requests',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    for (final l in items)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${l.fromDate == null ? '' : Formatters.formatShortDate(l.fromDate!)} → ${l.toDate == null ? '' : Formatters.formatShortDate(l.toDate!)}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                    ),
                                  ),
                                  if (l.reason != null)
                                    Text(
                                      l.reason!,
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
                      ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    String fmt(DateTime d) =>
        '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    try {
      await TeacherApi.instance.applyLeave(
        type: _type,
        fromDate: fmt(_from!),
        toDate: fmt(_to!),
        reason: _reason.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _from = null;
        _to = null;
        _reason.clear();
        _future = TeacherApi.instance.myLeaves();
      });
      AppToast.show(
        context,
        'Leave request submitted',
        type: ToastType.success,
      );
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Could not submit: $e', type: ToastType.error);
    }
  }
}

/// PTM requests assigned to (or visible for) this teacher, with respond flow.
class TeacherPtmScreen extends StatefulWidget {
  const TeacherPtmScreen({super.key});
  @override
  State<TeacherPtmScreen> createState() => _TeacherPtmScreenState();
}

class _TeacherPtmScreenState extends State<TeacherPtmScreen> {
  late Future<List<PtmModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = TeacherApi.instance.assignedPtm();
  }

  void _reload() {
    setState(() {
      _future = TeacherApi.instance.assignedPtm();
    });
  }

  void _openRequest() {
    showAppBottomSheet<void>(
      context: context,
      scrollable: true,
      child: _TeacherPtmRequestSheet(onDone: () {
        if (!mounted) return;
        AppToast.show(context, 'PTM request sent to the parent',
            type: ToastType.success);
        _reload();
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('PTM Requests'),
        actions: [
          IconButton(
            tooltip: 'Request a PTM',
            icon: const Icon(Iconsax.calendar_add, color: AppColors.textDark),
            onPressed: _openRequest,
          ),
        ],
      ),
      body: FutureBuilder<List<PtmModel>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final items = snap.data ?? const <PtmModel>[];
          if (items.isEmpty) {
            return EmptyState(
              emoji: '🤝',
              title: 'No PTM requests',
              subtitle:
                  'Parent requests appear here — or request a meeting yourself.',
              ctaLabel: 'Request a PTM',
              onCta: _openRequest,
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              padding: const EdgeInsets.all(20),
              children: [
                for (final p in items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: NeuCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  p.reason,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                              StatusChip(
                                label: switch (p.status) {
                                  'scheduled' => 'Scheduled',
                                  'declined' => 'Declined',
                                  'completed' => 'Completed',
                                  'cancelled' => 'Cancelled',
                                  _ => 'Requested',
                                },
                                type: switch (p.status) {
                                  'scheduled' => ChipType.success,
                                  'declined' || 'cancelled' => ChipType.danger,
                                  'completed' => ChipType.neutral,
                                  _ => ChipType.warning,
                                },
                              ),
                            ],
                          ),
                          if (p.preferredSlots.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Preferred: ${p.preferredSlots.join(', ')}',
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                          if (p.scheduledAt != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Scheduled: ${Formatters.formatDate(p.scheduledAt!)}',
                              style: const TextStyle(
                                color: AppColors.success,
                                fontSize: 12,
                              ),
                            ),
                          ],
                          // A teacher doesn't accept or reject a meeting — the
                          // school office decides that. Once the meeting has
                          // been held, the teacher who ran it can close it off.
                          if (p.status == 'requested') ...[
                            const SizedBox(height: 4),
                            const Text(
                              'Waiting for the school office to confirm',
                              style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                              ),
                            ),
                          ] else if (p.canBeCompleted) ...[
                            const SizedBox(height: 12),
                            NeuButton(
                              label: 'Mark done',
                              height: 46,
                              onPressed: () => _respond(p, 'completed'),
                            ),
                          ] else if (p.status == 'scheduled') ...[
                            const SizedBox(height: 4),
                            const Text(
                              'You can mark this done on the meeting date',
                              style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                              ),
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

  /// The only action a teacher has on a meeting: closing it off once it's been
  /// held. Scheduling and declining belong to the school office.
  Future<void> _respond(PtmModel p, String status) async {
    try {
      await TeacherApi.instance.respondPtm(p.id, status: status);
      if (!mounted) return;
      AppToast.show(context, 'Meeting marked done', type: ToastType.success);
      _reload();
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Failed: $e', type: ToastType.error);
    }
  }
}

/// Teacher-initiated PTM request: pick a student with a linked parent
/// account, give a reason — the school office then schedules or declines it,
/// and the parent is notified of the outcome.
class _TeacherPtmRequestSheet extends StatefulWidget {
  const _TeacherPtmRequestSheet({required this.onDone});
  final VoidCallback onDone;

  @override
  State<_TeacherPtmRequestSheet> createState() =>
      _TeacherPtmRequestSheetState();
}

class _TeacherPtmRequestSheetState extends State<_TeacherPtmRequestSheet> {
  List<Student>? _students;
  List<SchoolClass>? _myClasses;
  Student? _selected;

  /// Request for one child, or for every child in whole classes at once.
  bool _wholeClass = false;
  final _classIds = <String>{};

  final _reason = TextEditingController();
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final classes = await TeacherApi.instance.listMyClasses();
      final all = <Student>[];
      for (final c in classes) {
        all.addAll(await TeacherApi.instance.getClassStudents(c.id));
      }
      final linked =
          all.where((s) => (s.parentUserId ?? '').isNotEmpty).toList();
      if (mounted) {
        setState(() {
          _students = linked;
          _myClasses = classes;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not load your students');
    }
  }

  bool get _canSend {
    if (_sending || _reason.text.trim().isEmpty) return false;
    return _wholeClass ? _classIds.isNotEmpty : _selected != null;
  }

  Future<void> _send() async {
    setState(() => _sending = true);
    try {
      if (_wholeClass) {
        // One request per student in the chosen classes; the office decides.
        final res = await TeacherApi.instance.requestPtmForClasses(
          classIds: _classIds.toList(),
          reason: _reason.text.trim(),
        );
        if (!mounted) return;
        Navigator.of(context).pop();
        AppToast.show(
          context,
          res.skipped == 0
              ? 'Requested for ${res.created} students — '
                    'waiting for the office'
              : 'Requested for ${res.created}; ${res.skipped} skipped '
                    '(no parent account linked)',
          type: ToastType.success,
        );
      } else {
        final s = _selected!;
        await TeacherApi.instance.requestPtm(
          studentId: s.id,
          reason: _reason.text.trim(),
          parentId: s.parentUserId,
        );
        if (!mounted) return;
        Navigator.of(context).pop();
      }
      widget.onDone();
    } catch (e) {
      if (!mounted) return;
      setState(() => _sending = false);
      AppToast.show(context, 'Failed: $e', type: ToastType.error);
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
          const Text(
            'Request a PTM',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'The school office schedules or declines it, and the parents are '
            'notified of the outcome.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 12),
          if (_error != null)
            Text(_error!, style: const TextStyle(color: AppColors.textMuted))
          else if (_students == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            )
          else ...[
            // One child, or every child in a class the teacher teaches.
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, label: Text('One student')),
                ButtonSegment(value: true, label: Text('Whole class')),
              ],
              selected: {_wholeClass},
              onSelectionChanged: (v) =>
                  setState(() => _wholeClass = v.first),
            ),
            const SizedBox(height: 12),

            if (_wholeClass) ...[
              if ((_myClasses ?? const []).isEmpty)
                const Text(
                  'You have no classes assigned yet.',
                  style: TextStyle(color: AppColors.textMuted),
                )
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final c in _myClasses!)
                      NeuChip(
                        label: c.displayName,
                        selected: _classIds.contains(c.id),
                        accent: AppColors.teacherPrimary,
                        onTap: () => setState(() {
                          if (!_classIds.remove(c.id)) _classIds.add(c.id);
                        }),
                      ),
                  ],
                ),
            ] else if (_students!.isEmpty)
              const Text(
                'No students with linked parent accounts yet.',
                style: TextStyle(color: AppColors.textMuted),
              )
            else
              DropdownButtonFormField<Student>(
                initialValue: _selected,
                decoration: const InputDecoration(
                  labelText: 'Student',
                  border: OutlineInputBorder(),
                ),
                items: [
                  for (final s in _students!)
                    DropdownMenuItem(value: s, child: Text(s.fullName)),
                ],
                onChanged: (v) => setState(() => _selected = v),
              ),

            const SizedBox(height: 10),
            TextField(
              controller: _reason,
              maxLines: 2,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                labelText: 'Reason',
                hintText: 'e.g. discuss progress in class',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            PrimaryButton(
              label: _sending ? 'Sending…' : 'Send request',
              fullWidth: true,
              onPressed: _canSend ? _send : null,
            ),
          ],
        ],
      ),
    );
  }
}

class TeacherReportsScreen extends StatefulWidget {
  const TeacherReportsScreen({super.key});
  @override
  State<TeacherReportsScreen> createState() => _TeacherReportsScreenState();
}

class _TeacherReportsScreenState extends State<TeacherReportsScreen> {
  List<SchoolClass>? _classes;
  SchoolClass? _selectedClass;
  AttendanceClassSummary? _summary;

  @override
  void initState() {
    super.initState();
    TeacherApi.instance.listClasses().then((c) {
      if (mounted) setState(() => _classes = c);
    });
  }

  Future<void> _loadSummary(String classId) async {
    final today = DateTime.now();
    final date =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    final s = await TeacherApi.instance.getClassSummary(classId, date);
    if (mounted) setState(() => _summary = s);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Reports'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Class picker
          if (_classes == null)
            const Center(child: CircularProgressIndicator())
          else ...[
            NeuCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Select class',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.textDark,
                    ),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<SchoolClass>(
                    value: _selectedClass,
                    decoration: const InputDecoration(
                      hintText: 'Choose a class',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                    ),
                    items: _classes!.map((c) {
                      return DropdownMenuItem(
                        value: c,
                        child: Text(c.displayName),
                      );
                    }).toList(),
                    onChanged: (c) {
                      if (c == null) return;
                      setState(() {
                        _selectedClass = c;
                        _summary = null;
                      });
                      _loadSummary(c.id);
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Today's Attendance Summary
          if (_selectedClass != null && _summary != null) ...[
            _buildAttendanceReport(_summary!),
            const SizedBox(height: 16),
          ],

          // Static report cards (other report types)
          _ReportCard(
            icon: Iconsax.chart,
            title: 'Attendance Report',
            subtitle: 'Monthly attendance by student',
            onTap: () {
              AppToast.show(
                context,
                'Select a class above to view today\'s attendance',
                type: ToastType.info,
              );
            },
          ),
          const SizedBox(height: 12),
          _ReportCard(
            icon: Iconsax.book,
            title: 'Homework Completion',
            subtitle: 'Per-student homework submission rate',
            onTap: () {
              AppToast.show(
                context,
                'Homework reports coming soon',
                type: ToastType.info,
              );
            },
          ),
          const SizedBox(height: 12),
          _ReportCard(
            icon: Iconsax.note,
            title: 'Assessment Results',
            subtitle: 'Class assessment score averages',
            onTap: () {
              if (_selectedClass == null) {
                AppToast.show(
                  context,
                  'Select a class above first',
                  type: ToastType.info,
                );
                return;
              }
              Navigator.of(context).push(neuRoute(
                _AssessmentAveragesScreen(
                  classId: _selectedClass!.id,
                  className: _selectedClass!.displayName,
                ),
              ));
            },
          ),
        ],
      ),
    );
  }

  Widget _buildAttendanceReport(AttendanceClassSummary s) {
    final pct = s.total > 0 ? ((s.present / s.total) * 100).round() : 0;
    return NeuCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const NeuIconWell(
                icon: Iconsax.tick_circle,
                size: 42,
                iconSize: 20,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Today\'s Attendance',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textDark,
                      ),
                    ),
                    Text(
                      '${_selectedClass!.displayName} · ${DateTime.now().day}/${DateTime.now().month}',
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '$pct%',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: AppColors.teacherPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _StatChip('Present', s.present, AppColors.success),
              const SizedBox(width: 12),
              _StatChip('Absent', s.absent, AppColors.danger),
              const SizedBox(width: 12),
              _StatChip('Total', s.total, AppColors.teacherPrimary),
            ],
          ),
        ],
      ),
    );
  }
}

/// Per-assessment class averages (T4). Loads a class's assessments, then the
/// entered results for each, and shows the average score % — plus a headline
/// class average across all assessments that have results.
class _AssessmentAveragesScreen extends StatefulWidget {
  const _AssessmentAveragesScreen({
    required this.classId,
    required this.className,
  });
  final String classId;
  final String className;

  @override
  State<_AssessmentAveragesScreen> createState() =>
      _AssessmentAveragesScreenState();
}

class _AssessmentAveragesScreenState
    extends State<_AssessmentAveragesScreen> {
  late Future<List<_AssessmentAvg>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<_AssessmentAvg>> _load() async {
    final api = TeacherApi.instance;
    final assessments = await api.getAssessments(widget.classId);
    final out = <_AssessmentAvg>[];
    for (final a in assessments) {
      final results = await api.getAssessmentResults(a.id);
      final max = a.maxScore ?? 0;
      double? avgPct;
      if (results.isNotEmpty && max > 0) {
        final mean =
            results.map((r) => r.score).reduce((x, y) => x + y) /
                results.length;
        avgPct = (mean / max) * 100;
      }
      out.add(_AssessmentAvg(
        title: a.title,
        subject: a.subject,
        count: results.length,
        avgPct: avgPct,
      ));
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Assessment Results'),
      ),
      body: FutureBuilder<List<_AssessmentAvg>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return EmptyState(
              emoji: '📊',
              title: 'Could not load results',
              subtitle: '${snap.error}',
              ctaLabel: 'Retry',
              onCta: () => setState(() {
                _future = _load();
              }),
            );
          }
          final items = snap.data ?? const <_AssessmentAvg>[];
          if (items.isEmpty) {
            return const EmptyState(
              emoji: '📊',
              title: 'No assessments yet',
              subtitle: 'Create assessments in Academics to see averages here.',
            );
          }
          final scored = items.where((i) => i.avgPct != null).toList();
          final classAvg = scored.isEmpty
              ? null
              : scored.map((i) => i.avgPct!).reduce((x, y) => x + y) /
                  scored.length;
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            padding: const EdgeInsets.all(20),
            children: [
              NeuCard(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(widget.className,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textDark)),
                          const SizedBox(height: 2),
                          Text(
                              '${items.length} assessment${items.length == 1 ? '' : 's'} · ${scored.length} scored',
                              style: const TextStyle(
                                  color: AppColors.textMuted, fontSize: 12)),
                        ],
                      ),
                    ),
                    Text(
                      classAvg == null ? '—' : '${classAvg.round()}%',
                      style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          color: AppColors.teacherPrimary),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              for (final i in items) ...[
                NeuCard(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(i.title,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textDark)),
                            const SizedBox(height: 2),
                            Text(
                                '${i.subject ?? 'General'} · ${i.count} result${i.count == 1 ? '' : 's'}',
                                style: const TextStyle(
                                    color: AppColors.textMuted, fontSize: 12)),
                          ],
                        ),
                      ),
                      Text(
                        i.avgPct == null ? 'No results' : '${i.avgPct!.round()}%',
                        style: TextStyle(
                          fontSize: i.avgPct == null ? 13 : 20,
                          fontWeight: FontWeight.w700,
                          color: i.avgPct == null
                              ? AppColors.textMuted
                              : AppColors.teacherPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _AssessmentAvg {
  const _AssessmentAvg({
    required this.title,
    required this.subject,
    required this.count,
    required this.avgPct,
  });
  final String title;
  final String? subject;
  final int count;
  final double? avgPct;
}

class _StatChip extends StatelessWidget {
  const _StatChip(this.label, this.value, this.color);
  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppRadii.chip),
        ),
        alignment: Alignment.center,
        child: Column(
          children: [
            Text(
              '$value',
              style: TextStyle(
                fontSize: 18,
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
    );
  }
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return NeuCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          NeuIconWell(icon: icon, size: 42, iconSize: 20),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const Icon(
            Iconsax.arrow_right_3,
            color: AppColors.textMuted,
            size: 18,
          ),
        ],
      ),
    );
  }
}

class TeacherSettingsScreen extends StatelessWidget {
  const TeacherSettingsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Settings'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _SettingsRow(
            icon: Iconsax.user,
            label: 'Edit profile',
            onTap: () => _openEditProfile(context),
          ),
          const SizedBox(height: 12),
          _SettingsRow(
            icon: Iconsax.lock,
            label: 'Change password',
            onTap: () => _openChangePassword(context),
          ),
          const SizedBox(height: 12),
          _SettingsRow(
            icon: Iconsax.notification,
            label: 'Notifications',
            onTap: () => showAppBottomSheet<void>(
              context: context,
              child: const _TeacherNotificationPrefsSheet(),
            ),
          ),
          const SizedBox(height: 12),
          _SettingsRow(
            icon: Iconsax.info_circle,
            label: 'Help & FAQ',
            onTap: () => _openHelp(context),
          ),
          const SizedBox(height: 12),
          _SettingsRow(
            icon: Iconsax.shield_tick,
            label: 'Privacy Policy',
            onTap: () => Navigator.of(context).push(
              neuRoute(
                const PrivacyPolicyScreen(accent: AppColors.teacherPrimary),
              ),
            ),
          ),
          const SizedBox(height: 12),
          _SettingsRow(
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
            onPressed: () async {
              try {
                await TeacherApi.instance.updateMyProfile(
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
  final current = TextEditingController();
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
            controller: current,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Current password',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
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
                await TeacherApi.instance.updateMyProfile(password: newPw.text);
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
      'How do I mark attendance?',
      'Select your class from the Attendance tab, then tap P/A/L for each student.',
    ),
    (
      'How do I post homework?',
      'Go to Academics → Homework tab → tap + to create new homework.',
    ),
    (
      'How do I send a daily update?',
      'Go to Students → tap a student → Daily Update.',
    ),
  ];
  showAppBottomSheet<void>(
    context: context,
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

/// Teacher notification opt-ins — reuses the shared P7 endpoint
/// (GET/PATCH /users/me/notification-prefs). Shows only teacher-relevant
/// keys; loads the full pref map and sends it back unchanged bar the toggles,
/// so a parent's fee-reminder pref (if any) is preserved.
class _TeacherNotificationPrefsSheet extends StatefulWidget {
  const _TeacherNotificationPrefsSheet();
  @override
  State<_TeacherNotificationPrefsSheet> createState() =>
      _TeacherNotificationPrefsSheetState();
}

class _TeacherNotificationPrefsSheetState
    extends State<_TeacherNotificationPrefsSheet> {
  static const _items = [
    ('messageNotifications', 'Message notifications', 'New messages from parents'),
    ('attendanceAlerts', 'Attendance reminders', 'Reminders to mark class attendance'),
    ('homeworkNotifications', 'Homework reminders', 'Homework due dates'),
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
      final p = await TeacherApi.instance.getNotificationPrefs();
      if (mounted) setState(() { _prefs = p; _error = null; });
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not load preferences');
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await TeacherApi.instance.updateNotificationPrefs(_prefs!);
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
                child: CircularProgressIndicator(
                    color: AppColors.teacherPrimary),
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
                activeThumbColor: AppColors.teacherPrimary,
                onChanged: (v) => setState(() => _prefs![key] = v),
              ),
            const SizedBox(height: 8),
            PrimaryButton(
              label: _saving ? 'Saving…' : 'Save',
              color: AppColors.teacherPrimary,
              fullWidth: true,
              onPressed: _saving ? null : _save,
            ),
          ],
        ],
      ),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
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
    return NeuCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          NeuIconWell(icon: icon, color: c, size: 42, iconSize: 20),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: c,
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
        ],
      ),
    );
  }
}

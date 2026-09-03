class StudentGuardian {
  const StudentGuardian({
    required this.name,
    required this.relationship,
    required this.phone,
    this.email,
    this.occupation,
    this.isPrimary = false,
  });

  final String name;
  final String relationship;
  final String phone;
  final String? email;
  final String? occupation;
  final bool isPrimary;

  factory StudentGuardian.fromJson(Map<String, dynamic> j) => StudentGuardian(
        name: j['name'] as String? ?? '',
        relationship: j['relationship'] as String? ?? '',
        phone: j['phone'] as String? ?? '',
        email: j['email'] as String?,
        occupation: j['occupation'] as String?,
        isPrimary: j['isPrimary'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'relationship': relationship,
        'phone': phone,
        if (email != null && email!.isNotEmpty) 'email': email,
        if (occupation != null && occupation!.isNotEmpty)
          'occupation': occupation,
        'isPrimary': isPrimary,
      };
}

class EmergencyContact {
  const EmergencyContact({
    required this.name,
    required this.relationship,
    required this.phone,
  });

  final String name;
  final String relationship;
  final String phone;

  factory EmergencyContact.fromJson(Map<String, dynamic> j) => EmergencyContact(
        name: j['name'] as String? ?? '',
        relationship: j['relationship'] as String? ?? '',
        phone: j['phone'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'relationship': relationship,
        'phone': phone,
      };
}

class StudentAddress {
  const StudentAddress({
    this.line1,
    this.line2,
    this.city,
    this.state,
    this.postalCode,
    this.country,
  });

  final String? line1;
  final String? line2;
  final String? city;
  final String? state;
  final String? postalCode;
  final String? country;

  bool get isEmpty =>
      (line1 ?? '').isEmpty &&
      (line2 ?? '').isEmpty &&
      (city ?? '').isEmpty &&
      (state ?? '').isEmpty &&
      (postalCode ?? '').isEmpty;

  /// Human-readable one-liner, skipping blank parts.
  String get formatted => [line1, line2, city, state, postalCode]
      .where((p) => p != null && p.isNotEmpty)
      .join(', ');

  factory StudentAddress.fromJson(Map<String, dynamic> j) => StudentAddress(
        line1: j['line1'] as String?,
        line2: j['line2'] as String?,
        city: j['city'] as String?,
        state: j['state'] as String?,
        postalCode: j['postalCode'] as String?,
        country: j['country'] as String?,
      );

  Map<String, dynamic> toJson() => {
        if ((line1 ?? '').isNotEmpty) 'line1': line1,
        if ((line2 ?? '').isNotEmpty) 'line2': line2,
        if ((city ?? '').isNotEmpty) 'city': city,
        if ((state ?? '').isNotEmpty) 'state': state,
        if ((postalCode ?? '').isNotEmpty) 'postalCode': postalCode,
        if ((country ?? '').isNotEmpty) 'country': country,
      };
}

class Vaccination {
  const Vaccination({
    required this.name,
    this.doseLabel,
    this.administered = false,
    this.administeredOn,
    this.dueOn,
  });

  final String name;
  final String? doseLabel;
  final bool administered;
  final DateTime? administeredOn;
  final DateTime? dueOn;

  factory Vaccination.fromJson(Map<String, dynamic> j) => Vaccination(
        name: j['name'] as String? ?? '',
        doseLabel: j['doseLabel'] as String?,
        administered: j['administered'] as bool? ?? false,
        administeredOn: j['administeredOn'] != null
            ? DateTime.tryParse(j['administeredOn'] as String)
            : null,
        dueOn: j['dueOn'] != null
            ? DateTime.tryParse(j['dueOn'] as String)
            : null,
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'administered': administered,
        if ((doseLabel ?? '').isNotEmpty) 'doseLabel': doseLabel,
        if (administeredOn != null)
          'administeredOn': administeredOn!.toIso8601String(),
        if (dueOn != null) 'dueOn': dueOn!.toIso8601String(),
      };
}

class StudentMedicalInfo {
  const StudentMedicalInfo({
    this.bloodGroup,
    this.allergies = const [],
    this.conditions = const [],
    this.medications = const [],
    this.physicianName,
    this.physicianPhone,
    this.vaccinations = const [],
  });

  final String? bloodGroup;
  final List<String> allergies;
  final List<String> conditions;
  final List<String> medications;
  final String? physicianName;
  final String? physicianPhone;
  final List<Vaccination> vaccinations;

  bool get isEmpty =>
      (bloodGroup ?? '').isEmpty &&
      allergies.isEmpty &&
      conditions.isEmpty &&
      medications.isEmpty &&
      (physicianName ?? '').isEmpty &&
      (physicianPhone ?? '').isEmpty &&
      vaccinations.isEmpty;

  factory StudentMedicalInfo.fromJson(Map<String, dynamic> j) =>
      StudentMedicalInfo(
        bloodGroup: j['bloodGroup'] as String?,
        allergies: _stringList(j['allergies']),
        conditions: _stringList(j['conditions']),
        medications: _stringList(j['medications']),
        physicianName: j['physicianName'] as String?,
        physicianPhone: j['physicianPhone'] as String?,
        vaccinations: (j['vaccinations'] as List<dynamic>? ?? [])
            .map((v) => Vaccination.fromJson(v as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        if ((bloodGroup ?? '').isNotEmpty) 'bloodGroup': bloodGroup,
        'allergies': allergies,
        'conditions': conditions,
        'medications': medications,
        if ((physicianName ?? '').isNotEmpty) 'physicianName': physicianName,
        if ((physicianPhone ?? '').isNotEmpty) 'physicianPhone': physicianPhone,
        'vaccinations': vaccinations.map((v) => v.toJson()).toList(),
      };

  static List<String> _stringList(dynamic v) => (v as List<dynamic>? ?? [])
      .map((e) => e.toString())
      .where((e) => e.isNotEmpty)
      .toList();
}

class Student {
  const Student({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.admissionNumber,
    required this.gender,
    required this.status,
    this.dateOfBirth,
    this.classId,
    this.className,
    this.parentUserId,
    this.guardians = const [],
    this.emergencyContacts = const [],
    this.address,
    this.medicalInfo = const StudentMedicalInfo(),
    this.profileCompleted = false,
  });

  final String id;
  final String firstName;
  final String lastName;
  final String admissionNumber;
  final String gender;
  final String status;
  final DateTime? dateOfBirth;
  final String? classId;
  final String? className;
  final String? parentUserId;
  final List<StudentGuardian> guardians;
  final List<EmergencyContact> emergencyContacts;
  final StudentAddress? address;
  final StudentMedicalInfo medicalInfo;
  final bool profileCompleted;

  String get fullName => '$firstName $lastName';

  StudentGuardian? get primaryGuardian {
    if (guardians.isEmpty) return null;
    return guardians.firstWhere(
      (g) => g.isPrimary,
      orElse: () => guardians.first,
    );
  }

  String? get primaryGuardianPhone => primaryGuardian?.phone;

  factory Student.fromJson(Map<String, dynamic> j) => Student(
        id: j['_id'] as String? ?? j['id'] as String? ?? '',
        firstName: j['firstName'] as String? ?? '',
        lastName: j['lastName'] as String? ?? '',
        admissionNumber: j['admissionNumber'] as String? ?? '',
        gender: j['gender'] as String? ?? '',
        status: j['status'] as String? ?? 'active',
        dateOfBirth: j['dateOfBirth'] != null
            ? DateTime.tryParse(j['dateOfBirth'] as String)
            : null,
        classId: j['classId'] as String?,
        parentUserId: j['parentUserId'] as String?,
        guardians: (j['guardians'] as List<dynamic>? ?? [])
            .map((g) => StudentGuardian.fromJson(g as Map<String, dynamic>))
            .toList(),
        emergencyContacts: (j['emergencyContacts'] as List<dynamic>? ?? [])
            .map((e) => EmergencyContact.fromJson(e as Map<String, dynamic>))
            .toList(),
        address: j['address'] is Map<String, dynamic>
            ? StudentAddress.fromJson(j['address'] as Map<String, dynamic>)
            : null,
        medicalInfo: j['medicalInfo'] is Map<String, dynamic>
            ? StudentMedicalInfo.fromJson(
                j['medicalInfo'] as Map<String, dynamic>)
            : const StudentMedicalInfo(),
        profileCompleted: j['profileCompleted'] as bool? ?? false,
      );
}

class StudentStats {
  const StudentStats({required this.total, required this.byStatus});

  final int total;
  final Map<String, int> byStatus;

  factory StudentStats.fromJson(Map<String, dynamic> j) => StudentStats(
        total: j['total'] as int? ?? 0,
        byStatus: Map<String, int>.from(j['byStatus'] as Map? ?? {}),
      );
}

class PaginatedStudents {
  const PaginatedStudents({
    required this.data,
    required this.total,
    required this.page,
    required this.totalPages,
  });

  final List<Student> data;
  final int total;
  final int page;
  final int totalPages;

  factory PaginatedStudents.fromJson(Map<String, dynamic> j) =>
      PaginatedStudents(
        data: (j['data'] as List<dynamic>? ?? [])
            .map((e) => Student.fromJson(e as Map<String, dynamic>))
            .toList(),
        total: j['total'] as int? ?? 0,
        page: j['page'] as int? ?? 1,
        totalPages: j['totalPages'] as int? ?? 1,
      );
}

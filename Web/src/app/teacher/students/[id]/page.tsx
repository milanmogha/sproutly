'use client';

import { useParams } from 'next/navigation';
import { StudentDetail } from '@/components/shared/student-detail';

export default function TeacherStudentPage() {
  const { id } = useParams<{ id: string }>();
  // Teachers record remarks and milestones for the children they teach.
  return <StudentDetail studentId={id} canRecord canLogDiary />;
}

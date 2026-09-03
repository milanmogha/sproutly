'use client';

import { useParams } from 'next/navigation';
import { StudentDetail } from '@/components/shared/student-detail';

export default function AdminStudentPage() {
  const { id } = useParams<{ id: string }>();
  return <StudentDetail studentId={id} canRecord canEdit />;
}

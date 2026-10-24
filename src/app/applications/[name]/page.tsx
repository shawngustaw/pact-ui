import { ApplicationDetails } from '@/components/application-details';
export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <ApplicationDetails name={name} />;
}

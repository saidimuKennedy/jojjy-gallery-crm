import Head from "next/head";
import DashboardLayout from "@/components/DashboardLayout";
import MediaBlogManagement from "@/components/Admin/MediaBlogManagement";

export default function MediaBlogPage() {
  return (
    <DashboardLayout>
      <Head>
        <title>Media & Blog — Jojjy Gallery CRM</title>
      </Head>
      <MediaBlogManagement />
    </DashboardLayout>
  );
}

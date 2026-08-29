import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/artworks/:path*",
    "/api/series/:path*",
    "/api/media-blog/:path*",
    "/api/events/:path*",
    "/api/products/:path*",
    "/api/announcements/:path*",
    "/api/music/:path*",
    "/api/upload/:path*",
  ],
};

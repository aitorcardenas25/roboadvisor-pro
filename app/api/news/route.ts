import { NextRequest, NextResponse } from 'next/server';
import { getPublishedNews, getFeaturedNews } from '@/lib/news';
import type { NewsCategory } from '@/lib/news';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get('category') as NewsCategory | null;
  const featured = searchParams.get('featured') === 'true';

  const news = featured ? getFeaturedNews() : getPublishedNews(category ?? undefined);
  return NextResponse.json({ news });
}

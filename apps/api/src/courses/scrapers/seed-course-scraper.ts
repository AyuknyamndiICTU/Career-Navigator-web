import {
  CourseScrapeCandidateSeed,
  getCourseScrapeCandidateSeedData,
} from '../course-catalog-seed.service';

export type ScrapedCourseCandidate = CourseScrapeCandidateSeed;

export type CourseScraper = {
  platform: string;
  scrapeCandidates: () => Promise<ScrapedCourseCandidate[]>;
};

export class SeedCourseCatalogScraper implements CourseScraper {
  public readonly platform: string;

  constructor(platform: string) {
    this.platform = platform.trim().toLowerCase();
  }

  async scrapeCandidates(): Promise<ScrapedCourseCandidate[]> {
    const all = getCourseScrapeCandidateSeedData();

    // Bootstrap mode: “scraping” is selecting from our internal seed catalog.
    // Later, replace each platform scraper with real HTML parsing output.
    return all.filter((c) => c.platform === this.platform);
  }
}

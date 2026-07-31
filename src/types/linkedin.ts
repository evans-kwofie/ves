export interface LinkedInPost {
  id: string;
  content: string;
  keywordId: string | null;
  createdAt: string;
  postedAt: string | null;
  linkedinPostId: string | null;
}

export interface LinkedInLeadResult {
  company: string;
  name: string;
  linkedinUrl: string;
  whatTheyDo: string;
  website: string;
}

export interface LinkedInPost {
  id: string;
  content: string;
  keywordId: string | null;
  createdAt: string;
}

export interface LinkedInLeadResult {
  company: string;
  name: string;
  linkedinUrl: string;
  whatTheyDo: string;
  website: string;
}

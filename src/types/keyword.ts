export interface Keyword {
  id: string;
  keyword: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  subreddits?: Subreddit[];
}

export interface Subreddit {
  id: string;
  name: string;
  keywordId: string;
  createdAt: string;
}

export interface CreateKeywordInput {
  keyword: string;
  subreddits?: string[];
}

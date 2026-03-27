export type IntentType = "buying" | "pain" | "discussion" | "noise";
export type EngagementType = "helpful" | "pitch" | "authority" | "question";

export interface RedditPost {
  id: string;
  redditId: string;
  subreddit: string;
  title: string;
  url: string;
  author: string;
  score: number;
  body: string;
  keywordId: string | null;
  replySuggestion: string | null;
  intentType: IntentType | null;
  intentScore: number | null;
  engagementType: EngagementType | null;
  engagementScore: number | null;
  fetchedAt: string;
}

export interface RedditApiChild {
  data: {
    id: string;
    subreddit: string;
    title: string;
    url: string;
    author: string;
    score: number;
    selftext: string;
    permalink: string;
  };
}

export interface RedditApiResponse {
  data: {
    children: RedditApiChild[];
  };
}

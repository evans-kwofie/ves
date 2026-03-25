export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlogPostInput {
  title: string;
  content: string;
  keywords: string[];
}

export interface UpdateBlogPostInput {
  title?: string;
  content?: string;
  keywords?: string[];
}

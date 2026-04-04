import * as z from 'zod'

export const redditFilterSchema = z.object({
    intent: z.enum(['buying', 'pain', 'discussion', 'noise']).optional(),
    sort: z.enum(['score', 'intentScore', 'newest']).optional(),
    keyword: z.string().optional()
})
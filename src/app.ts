import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

export const app = new OpenAPIHono()

const HealthSchema = z
  .object({
    status: z.literal('ok'),
  })
  .openapi('Health')

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  summary: 'Check that the API is up',
  responses: {
    200: {
      description: 'The API is up',
      content: {
        'application/json': { schema: HealthSchema },
      },
    },
  },
})

app.openapi(healthRoute, (c) => {
  return c.json({ status: 'ok' } as const, 200)
})

// The contract the frontend generates its types and client from.
app.doc31('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Indudex API',
    version: '0.1.0',
  },
})

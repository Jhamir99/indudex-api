import { describe, expect, it } from 'vitest'
import { app } from './app.js'

describe('GET /health', () => {
  it('reports that the API is up', async () => {
    const response = await app.request('/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})

describe('GET /openapi.json', () => {
  it('describes the health route and its schema', async () => {
    const response = await app.request('/openapi.json')
    const spec = await response.json()

    expect(response.status).toBe(200)
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.paths['/health'].get).toBeDefined()
    expect(spec.components.schemas.Health).toBeDefined()
  })
})

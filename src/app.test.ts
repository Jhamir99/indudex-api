import { describe, expect, it } from 'vitest'
import { app } from './app.js'

describe('GET /', () => {
  it('responds with a greeting', async () => {
    const response = await app.request('/')

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('Hello Hono!')
  })
})

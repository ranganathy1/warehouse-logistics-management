// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest"
import api from "./axios"

describe("API authentication interceptors", () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, "", "/login")
  })

  it("adds the stored bearer token to requests", async () => {
    localStorage.setItem("token", "test-token")

    await api.get("/items", {
      adapter: (config) => {
        expect(config.headers.Authorization).toBe("Bearer test-token")
        return Promise.resolve({
          config,
          data: [],
          headers: {},
          status: 200,
          statusText: "OK",
        })
      },
    })
  })

  it("clears saved credentials after an unauthorized response", async () => {
    localStorage.setItem("token", "expired-token")
    localStorage.setItem("user", "saved-user")

    await expect(
      api.get("/items", {
        adapter: (config) =>
          Promise.reject({
            config,
            response: {
              data: { detail: "Unauthorized" },
              status: 401,
            },
          }),
      }),
    ).rejects.toMatchObject({ response: { status: 401 } })

    expect(localStorage.getItem("token")).toBeNull()
    expect(localStorage.getItem("user")).toBeNull()
  })
})
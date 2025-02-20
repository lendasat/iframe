# Changelog

https://nx.dev/concepts/typescript-project-linking

So i am first moving all "libs" to the packages folder.
i am adding `workspace` property in the root package.json, and adding all the necessary package.jsons to apps and packages.
i am updating all tsconfigs that have errors

why would `@frontend/http-client-borrower` import `@frontend/ui-shared` ???
why would `@frontend/http-client-lender` import `@frontend/http-client-borrower` ???

Import wasm in vite properly ? https://github.com/vitejs/vite/discussions/2584#discussioncomment-1697534

# Changelog

https://nx.dev/concepts/typescript-project-linking

So i am first moving all "libs" to the packages folder.
i am adding `workspace` property in the root package.json, and adding all the necessary package.jsons to apps and packages.
i am updating all tsconfigs that have errors

why would `@lendasat/http-client-borrower` import `@lendasat/ui-shared` ???
why would `@lendasat/http-client-lender` import `@lendasat/http-client-borrower` ???

Import wasm in vite properly ? https://github.com/vitejs/vite/discussions/2584#discussioncomment-1697534

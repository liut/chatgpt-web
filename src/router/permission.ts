import type { Router } from 'vue-router'
import { useAuthStoreWithout } from '@/store/modules/auth'

import { useUserStore } from '@/store'

export function setupPageGuard(router: Router) {
  router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStoreWithout()
    const userStore = useUserStore()
    if (!authStore.session) {
      try {
        const data = await authStore.getSession()
        if (String(data.auth) === 'false' && authStore.token)
          authStore.removeToken()

        if (data.uri && typeof data.uri === 'string' && data.uri.trim() !== '') {
          window.location.href = data.uri
          /* eslint-disable-next-line no-useless-return */
          return // Necessary to stop router navigation after browser redirect
        }
        else if (to.path === '/500') {
          next({ name: 'Root' })
        }
        else {
          console.log(data.user)
          if (typeof data.user == 'object')
            userStore.updateUserInfo(data.user)

          next()
        }
      }
      catch (error) {
        if (to.path !== '/500')
          next({ name: '500' })
        else
          next()
      }
    }
    else {
      next()
    }
  })
}

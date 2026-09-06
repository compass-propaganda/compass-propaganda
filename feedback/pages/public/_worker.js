// SPDX-License-Identifier: MIT
export default {
  fetch(request, env) {
    return env.FEEDBACK.fetch(request);
  },
};

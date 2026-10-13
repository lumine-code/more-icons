const loaders = {
  "file-icons": () => import("./set-file-icons.js"),
  seti: () => import("./set-seti.js"),
};
const loading = new Map();

module.exports = {
  load(name) {
    if (!loading.has(name)) {
      const pending = loaders[name]()
        .then((namespace) => namespace.default ?? namespace)
        .catch((error) => {
          loading.delete(name);
          throw error;
        });
      loading.set(name, pending);
    }
    return loading.get(name);
  },
};

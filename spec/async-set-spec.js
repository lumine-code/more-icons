describe("native icon set initialization ownership", () => {
  let pack, loader, service;
  const target = { path: "/p/main.js", hints: {} };
  const deferred = () => {
    let resolve;
    const promise = new Promise((complete) => {
      resolve = complete;
    });
    return { promise, resolve };
  };

  beforeEach(() => {
    jasmine.useRealClock();
    lumine.config.set("more-icons.set", "file-icons");
    pack = lumine.packages.loadPackage("more-icons");
    pack.requireMainModule();
    loader = require("../lib/set-loader");
  });
  afterEach(async () => {
    await lumine.packages.deactivatePackage("more-icons");
    lumine.config.unset("more-icons.set");
  });

  it("does not install or read a set after deactivation during its import", async () => {
    const pending = deferred();
    const next = { load: jasmine.createSpy("load icon theme") };
    spyOn(loader, "load").and.returnValue(pending.promise);
    await lumine.packages.activatePackage("more-icons");
    await lumine.packages.deactivatePackage("more-icons");
    pending.resolve(next);
    await flushMicrotasks();
    expect(next.load).not.toHaveBeenCalled();
    expect(document.head.querySelector("style[data-more-icons]")).toBeNull();
  });

  it("ignores an old import after the configured icon set changes", async () => {
    const actualSeti = await loader.load("seti");
    const pending = deferred();
    const retired = { load: jasmine.createSpy("retired theme") };
    spyOn(loader, "load").and.callFake((name) =>
      name === "file-icons" ? pending.promise : Promise.resolve(actualSeti),
    );
    await lumine.packages.activatePackage("more-icons");
    service = pack.mainModule.provideIcons();
    lumine.config.set("more-icons.set", "seti");
    await conditionPromise(() =>
      service.iconFor(target)?.classes.some((name) => name.startsWith("mi-s-")),
    );
    pending.resolve(retired);
    await flushMicrotasks();
    expect(retired.load).not.toHaveBeenCalled();
    expect(service.iconFor(target).classes.some((name) => name.startsWith("mi-s-"))).toBe(true);
  });

  it("keeps the core fallback after a failed import and retries on a later request", async () => {
    const actualLoad = loader.load.bind(loader);
    let first = true;
    spyOn(loader, "load").and.callFake((name) => {
      if (first) {
        first = false;
        return Promise.reject(new Error("Cannot import icon set"));
      }
      return actualLoad(name);
    });
    const warning = spyOn(lumine.notifications, "addError");
    await lumine.packages.activatePackage("more-icons");
    service = pack.mainModule.provideIcons();
    await conditionPromise(() => warning.calls.count() > 0);
    expect(service.iconFor(target)).toBeNull();
    await conditionPromise(() => service.iconFor(target) !== null);
    expect(service.iconFor(target).classes).toContain("mi-g-js-icon");
  });
});

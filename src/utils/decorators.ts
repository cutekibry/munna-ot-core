/**
 * Marks a class method as abstract method (needs to be implemented in the subclass).
 */
function abstract(target: any, key: string, desc: PropertyDescriptor) {
  const ref = desc.value;
  desc.value = (...args) => {
    throw new Error(`${target}.${key} needs to be implemented`);
    return ref.apply(this, args);
  };
}

export { abstract };
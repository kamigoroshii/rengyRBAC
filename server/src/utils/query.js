export const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const buildSearchFilter = (fields, search) => {
  if (!search) {
    return {};
  }

  // Escape special regex characters to prevent injection / 500 errors
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return {
    $or: fields.map((field) => ({
      [field]: { $regex: escaped, $options: 'i' },
    })),
  };
};

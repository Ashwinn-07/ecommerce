const paginate = async (model, query, page = 1, limit) => {
  try {
    const skip = (page - 1) * limit;
    const count = await model.countDocuments(query);
    const totalPages = Math.ceil(count / limit);

    const data = await model.find(query).limit(limit).skip(skip).exec();

    return {
      data,
      totalPages,
      currentPage: page,
      totalItems: count,
    };
  } catch (error) {
    throw new Error("Pagination Error: " + error.message);
  }
};

module.exports = paginate;

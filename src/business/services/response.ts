const response = (statusCode = 200, success = false, message = '', data = {}) => {
    return {
        statusCode,
        success,
        message,
        data,
    }
}

export default response
import { httpStatus } from "src/infra/helpers/httpStatusEnum"

/**
 * TODO: need to verify if is really necessary initate any entry prop
 * 
 * this kind of impplementation need to be extremely necessary
 */

const response = (statusCode = httpStatus.Ok, success = false, message = '', data = {}) => {
    return {
        statusCode,
        success,
        message,
        data,
    }
}

export default response
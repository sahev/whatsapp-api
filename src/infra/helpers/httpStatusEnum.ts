export enum httpStatus {
    // success status
    Ok = 200,
    Created = 201,
    NoContent = 204,

    // client error
    BadRequest = 400,
    Unauthorized = 401,
    Forbidden = 403,
    NotFound = 404,
    MethodNotAllowed = 405,
    Conflict = 409,

    // server error
    internalServerError = 500,
    NotImplemented = 501,
    BadGateway = 502,
    ServiceUnavailable = 503,
}

/**
 * implementation made by FS
 * 
 * font https://www.webfx.com/web-development/glossary/http-status-codes/
 * 
 * in this website there are a lot of httpStatus to be implemented * 
 * 
 */

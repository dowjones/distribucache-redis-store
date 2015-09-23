import requireDirectory from 'require-directory';


/**
 * This file makes sure all files have been tested.
 * Include all newly created source directories here.
 */

export default requireDirectory(module, '../src');

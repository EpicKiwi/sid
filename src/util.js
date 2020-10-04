function format(s, args) {
    let re = /\{([^}]+)\}/g;
    return s.replace(re, (_, match) => args[match]);
}

module.exports = {
    format
}
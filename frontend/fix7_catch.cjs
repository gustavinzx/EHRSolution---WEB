const fs = require("fs");

let content = fs.readFileSync("src/pages/DriversPage.jsx", "utf8");
content = content.replace(
  "    fetchRanking().then(res => {\n      setRanking(res);\n      setLoadingRank(false);\n    });",
  "    fetchRanking().then(res => {\n      setRanking(res || []);\n      setLoadingRank(false);\n    }).catch(err => {\n      console.error(err);\n      setLoadingRank(false);\n    });"
);
fs.writeFileSync("src/pages/DriversPage.jsx", content);

let content2 = fs.readFileSync("src/pages/FuelingPage.jsx", "utf8");
content2 = content2.replace(
  "      getActiveSession(truckId).then(sess => {\n        setSession(sess);\n      });",
  "      getActiveSession(truckId).then(sess => {\n        setSession(sess || null);\n      }).catch(err => {\n        console.error(err);\n        setSession(null);\n      });"
);
fs.writeFileSync("src/pages/FuelingPage.jsx", content2);

console.log("Bug 7 (Promises without catch) patched");

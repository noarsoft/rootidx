const fs = require("fs");
const path = require("path");


// const list_folder = [
//   "src",
//   "src/components",
//   "src/components/controls",
//   "src/components/controls/crud",
//   "src/components/controls_doc",
//   "src/components/controls_doc/pages",
// ];

const list_folder = [
  "src/forms",
  "src/lib",
];


const output = path.join(__dirname, "all_code.txt");

let result = "";

const path_to_root = "C:\\camt study\\research\\rootid_system\\cakecontrol";


for (const folder of list_folder) {
  const files = fs.readdirSync( path.join(path_to_root, folder));
  for (const file of files) {
    const filePath = path.join(path_to_root, folder, file);
    if (fs.statSync(filePath).isFile()) {
      result += `\n\n===== ${filePath} =====\n`;
      result += fs.readFileSync(filePath, "utf8");
    }
  }
}

fs.writeFileSync(output, result);

console.log("Done!");
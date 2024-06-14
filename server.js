const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Define the path to the CSV file
const csvFilePath = path.join(__dirname, 'wsmdata.csv');

// Endpoint to read the CSV file and process its content
app.get('/process-csv', (req, res) => {
    const results = [];

    fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
            const categoryName = row['WSM_CATNAME'];
            const longDesc = row['LONG_DESC'];
            const metaDesc = row['METADESCRIPTION'];
            const MetaTitle = row['META TITLE'];
            const MetaKeywordsString = row['KEYWORDS'];
            const extendedDesc = row['EXTENDED DESCRIPTION'];

            let description = longDesc;
            // if (extendedDesc) {
            //     description += `<br>${extendedDesc}`;
            // }
            let MetaKeywords = MetaKeywordsString.split(", ").map(item => item.trim());


            results.push({ categoryName, description, metaDesc, MetaTitle, MetaKeywords });
        })
        .on('end', () => {
            // Save results to a JSON file
            const outputFilePath = path.join(__dirname, 'output.json');
            fs.writeFileSync(outputFilePath, JSON.stringify(results, null, 2));

            res.send('CSV processing completed. Data saved to output.json.');
        })
        .on('error', (error) => {
            console.error('Error processing CSV file:', error);
            res.status(500).send('An error occurred while processing the CSV file.');
        });
});

// Define the path to the output JSON file
const outputFilePath = path.join(__dirname, 'output.json');

// Define the paths to the new JSON files
const emptyDescFilePath = path.join(__dirname, 'empty_desc.json');
const existingDescFilePath = path.join(__dirname, 'existing_desc.json');
const noResponseFilePath = path.join(__dirname, 'no_response.json');
const errorFilePath = path.join(__dirname, 'error.json');
const emptyDescMetaDataFilePath = path.join(__dirname, 'empty_desc_metadata.json');

// Function to make API request and get category_id
const getCategoryId = async (categoryName, description, page_title, metaDesc, metaKeywords) => {
    const { Headers, default: fetch } = await import('node-fetch');

    const myHeaders = new Headers();
    myHeaders.append("X-Auth-Token", "90iph80fw7sgemjijz54frmydqql2gb");
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Accept", "application/json");

    const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow"
    };

    try {
        const response = await fetch(`https://api.bigcommerce.com/stores/bohausxa6o/v3/catalog/trees/categories?name=${encodeURIComponent(categoryName)}`, requestOptions);
        const result = await response.json();
        if (result.data && result.data.length > 0) {
            const categoryId = result.data[0].category_id;
            const meta_description = result.data[0].meta_description;
            const meta_keywords = result.data[0].meta_keywords;
            const page_title_ = result.data[0].page_title;
            return {
                categoryId, categoryName, description, responseDesc: result.data[0].description || "", page_title: page_title_ || "",
                meta_keywords: meta_keywords || "",
                meta_description: meta_description || ""
            };
        } else {
            return { categoryId: null, categoryName, description, error: "No response data" };
        }
    } catch (error) {
        console.error(`Error fetching category ${categoryName}:`, error);
        return { categoryId: null, categoryName, description, error: error.message };
    }
};

// Endpoint to read the JSON file and process its content
app.get('/process-categories', async (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
        const promises = data.map(item => getCategoryId(item.categoryName, item.description, item?.MetaTitle,
            item?.metaDesc, item?.meta_keywords
        ));
        const results = await Promise.all(promises);

        // Separate results
        const emptyDescResults = [];
        const existingDescResults = [];
        const noResponseResults = [];
        const errorResults = [];

        results.forEach(result => {
            if (result.error) {
                if (result.error === "No response data") {
                    noResponseResults.push(result);
                } else {
                    errorResults.push(result);
                }
            } else if (result.responseDesc) {
                existingDescResults.push({
                    categoryId: result.categoryId,
                    categoryName: result.categoryName,
                    description: result.description,
                    responseDesc: result.responseDesc
                });
            } else {
                emptyDescResults.push({
                    categoryId: result.categoryId,
                    categoryName: result.categoryName,
                    description: result.description,
                    page_title: result.page_title,
                    meta_description: result.meta_description,
                    meta_keywords: result.meta_keywords,
                });
            }
        });

        // Save results to respective files
        fs.writeFileSync(emptyDescFilePath, JSON.stringify(emptyDescResults, null, 2));
        fs.writeFileSync(existingDescFilePath, JSON.stringify(existingDescResults, null, 2));
        fs.writeFileSync(noResponseFilePath, JSON.stringify(noResponseResults, null, 2));
        fs.writeFileSync(errorFilePath, JSON.stringify(errorResults, null, 2));

        res.send('Categories processed and saved to respective files.');
    } catch (error) {
        console.error('Error processing categories:', error);
        res.status(500).send('An error occurred while processing categories.');
    }
});

// Endpoint to read the JSON file and process its content
app.get('/process-empty-desc', async (req, res) => {
    try {
        const dataOutput = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
        const dataEmpty = JSON.parse(fs.readFileSync(emptyDescFilePath, 'utf8'));
        // const result = dataEmpty.map(obj1 => dataOutput.find(obj2 => obj2.id === obj1.id)).filter(Boolean);
        // const result = dataEmpty.map(obj1 => dataOutput.find(obj2 => obj2.categoryName === obj1.categoryName)).filter(Boolean);
        const result = dataOutput.map(obj2 => {
            const match = dataEmpty.find(obj1 => obj1.name === obj2.name);
            if (match) {
              return { ...obj2, categoryId: match.categoryId };
            }
            return obj2;
          });
        fs.writeFileSync(emptyDescMetaDataFilePath, JSON.stringify(result, null, 2));


        res.send('Categories processed and saved to respective files.');
    } catch (error) {
        console.error('Error processing categories:', error);
        res.status(500).send('An error occurred while processing categories.');
    }
});



// Update the categories opf empty desc categories
// Define the path to the empty_desc JSON file
const putResponseFilePath = path.join(__dirname, 'put_responses.json');
const metaDataPputResponseFilePath = path.join(__dirname, 'metadata_put_responses.json');
const emptyDescCategoriesFilePath = path.join(__dirname, 'empty_desc_categories.json');

// Function to make the PUT request to update category description
const updateCategoryDescription = async (category) => {
    if (!category.description) {
        console.log(`Category ${category.categoryName} has empty description. Skipping...`);
        return { categoryId: category.categoryId, categoryName: category.categoryName, description: category.description };
    }
    const { Headers, default: fetch } = await import('node-fetch');

    const myHeaders = new Headers();
    myHeaders.append("X-Auth-Token", "90iph80fw7sgemjijz54frmydqql2gb");
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Accept", "application/json");

    const body = JSON.stringify([
        {
            category_id: category.categoryId,
            description: category.description
        }
    ]);

    const requestOptions = {
        method: "PUT",
        headers: myHeaders,
        body: body,
        redirect: "follow"
    };

    try {
        const response = await fetch("https://api.bigcommerce.com/stores/bohausxa6o/v3/catalog/trees/categories", requestOptions);
        const result = await response.json();
        return { categoryId: category.categoryId, categoryName: category.categoryName, response: result };
    } catch (error) {
        console.error(`Error updating category ${category.categoryName}:`, error);
        return { categoryId: category.categoryId, categoryName: category.categoryName, error: error.message };
    }
};

// Function to make the PUT request to update category description
const updateCategoryMeta = async (category) => {
    if (!category.description) {
        console.log(`Category ${category.categoryName} has empty description. Skipping...`);
        return { categoryId: category.categoryId, categoryName: category.categoryName, description: category.description };
    }
    const { Headers, default: fetch } = await import('node-fetch');

    const myHeaders = new Headers();
    myHeaders.append("X-Auth-Token", "90iph80fw7sgemjijz54frmydqql2gb");
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Accept", "application/json");

    const body = JSON.stringify([
        {
            category_id: category.categoryId,
            page_title: category.page_title,
            meta_description: category.meta_description,
            meta_keywords: category.meta_keywords,
        }
    ]);

    const requestOptions = {
        method: "PUT",
        headers: myHeaders,
        body: body,
        redirect: "follow"
    };

    try {
        const response = await fetch("https://api.bigcommerce.com/stores/bohausxa6o/v3/catalog/trees/categories", requestOptions);
        const result = await response.json();
        return { categoryId: category.categoryId, categoryName: category.categoryName, response: result };
    } catch (error) {
        console.error(`Error updating category ${category.categoryName}:`, error);
        return { categoryId: category.categoryId, categoryName: category.categoryName, error: error.message };
    }
};

// Endpoint to process the empty_desc.json file and make PUT requests
app.get('/update-categories', async (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(emptyDescFilePath, 'utf8'));
        const promises = data.map(item => updateCategoryDescription(item));
        const results = await Promise.all(promises);

        // Filter out null results (categories with empty descriptions)
        const validResults = results.filter(result => result !== null);

        // Filter out categories with empty descriptions
        const emptyDescCategories = data.filter(item => !item.description.trim());

        fs.writeFileSync(putResponseFilePath, JSON.stringify(validResults, null, 2));
        fs.writeFileSync(emptyDescCategoriesFilePath, JSON.stringify(emptyDescCategories, null, 2));

        // fs.writeFileSync(putResponseFilePath, JSON.stringify(results, null, 2));

        res.send('Categories updated and responses saved to file.');
    } catch (error) {
        console.error('Error updating categories:', error);
        res.status(500).send('An error occurred while updating categories.');
    }
});

// Endpoint to process the empty_desc.json file and make PUT requests
app.get('/update-categories-meta-data', async (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(emptyDescMetaDataFilePath, 'utf8'));
        const promises = data.map(item => updateCategoryMeta(item));
        const results = await Promise.all(promises);

        // Filter out null results (categories with empty descriptions)
        const validResults = results.filter(result => result !== null);

        // Filter out categories with empty descriptions
        // const emptyDescCategories = data.filter(item => !item.description.trim());

        fs.writeFileSync(metaDataPputResponseFilePath, JSON.stringify(validResults, null, 2));

        res.send('Categories updated and responses saved to file.');
    } catch (error) {
        console.error('Error updating categories:', error);
        res.status(500).send('An error occurred while updating categories.');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

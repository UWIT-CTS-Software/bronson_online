use diesel::{
    prelude::*,
    sql_types::{
        Nullable,
        Array,
        Text,
    },
    serialize::{
        ToSql,
        Output,
    },
    AsExpression,
    backend::Backend,
    FromSqlRow,
};


#[derive(Debug, FromSqlRow, AsExpression)]
#[diesel(sql_type = Array<Nullable<Text>>)]
pub struct Db2DArray(pub Vec<String>);

impl Into<Db2DArray> for Vec<String> {
    fn into(self) -> Db2DArray {
        return Db2DArray(self);
    }
}

impl<DB> ToSql<Array<Nullable<Text>>, DB> for Db2DArray
    where
        DB: Backend,
        Vec<String>: ToSql<Array<Nullable<Text>>, DB>,
{
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, DB>) -> Result {
        return self.0.to_sql(out);
    }
}



#[allow(non_camel_case_types)]
#[derive(Debug, PartialEq, Queryable, Selectable, Insertable)]
#[diesel(table_name = crate::schema::buildings)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DB_Building {
    pub abbrev: String,
    pub name: String,
    pub lsm_name: String,
    pub zone: i16,
}


#[allow(non_camel_case_types)]
#[derive(Debug, PartialEq, Queryable, Selectable, Insertable)]
#[diesel(table_name = crate::schema::rooms)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DB_Room {
    pub abbrev: String,
    pub name: String,
    pub checked: bool,
    pub last_checked: String,
    pub gp: bool,
    pub available: bool,
    pub until: String,
    #[diesel(serialize_as = Db2DArray)]
    pub hostnames: Vec<String>,
    #[diesel(serialize_as = Db2DArray)]
    pub ips: Vec<String>
}


#[allow(non_camel_case_types)]
#[derive(Debug, PartialEq, Queryable, Selectable, Insertable)]
#[diesel(table_name = crate::schema::admins)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DB_Admin {
    pub admin: String,
}


#[allow(non_camel_case_types)]
#[derive(Debug, PartialEq, Queryable, Selectable, Insertable)]
#[diesel(table_name = crate::schema::data)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DB_DataElement {
    pub key: String,
    pub val: String,
}
